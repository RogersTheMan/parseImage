/* Based on jQuery Canvas Area Draw plugin - Copyright 2013 Fahrenheit Marketing
 * http://fahrenheitmarketing.com/ - License available on https://github.com/fahrenheit-marketing/jquery-canvas-area-draw/blob/master/LICENSE.txt 
 *
 *	Heavily edited by Daniele Perilli - https://www.sqlbi.com
 *	
 *	Version: 1.9.2 (2017.04.28)
 */

(function( $ ){
	
	var $this, $canvas, $menu, ctx, info, mapImage, shapes, activeShape, activePoint, canvasPoint, shapePoints, createNewShape, autoCreateNewShape, anchorLastTime, imageColors, grabbingTimeout;
	var isMarching = false;
	var isSVG = false;
	var tools = ['magicwand', 'crosshair', 'default', 'grab'];
	var currentTool = tools[0];
	var w, h, actualW, actualH;

	var actualZoom = 100;
	var availableZooms = [6.25, 12.5, 16.67, 25, 33.3, 50, 66.67, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
	var imagesPath, exportDialog, publishDialog, showGrid, snapToGrid, gridSize, gridPosition;
	
	
	$.fn.canvasAreaDraw = function(options) {
		$this = $(this);
		
		$this.reset = function(){
			reset();
		};
		reset();
		
		$this.resize = function(){
			resize();
		};
		
		$this.addShape = function(){
			addShape();
		};
		
		$this.removeShape = function(index){
			removeShape(index);
		};
		
		$this.toggleGrid = function(show){
			showGrid = show;
			draw();
		};
		
		$this.toggleSnap = function(enable){
			snapToGrid = enable;
		};
		
		$this.changeGridSize = function(increase){
			gridSize = (increase ? gridSize+=1 : (gridSize > 1 ? gridSize-=1 : gridSize));
			draw();
		};
		
		$this.changeTool = function(tool) {
			currentTool = tool;
			setCursor();
		};
		
		$this.getThumbnail = function() {
			return getThumbnail();
		};
		
		$this.getMap = function(anonymize) {
			return getMap(anonymize, true);
		};
		
        $this.changeMap = function(image, anonymous) {
            changeMap(image, anonymous);
        };
        
		$this.zoomIn = function() {
			
			for (var i= 0; i < availableZooms.length; i++) {
				if (Math.floor(availableZooms[i]) > Math.floor(actualZoom)) {
					zoom(null, i);
					break;
				}		
			}

		};
		
		$this.zoomOut = function() {
			
			for (var i = availableZooms.length - 1; i >= 0; i--) {
				if (Math.floor(availableZooms[i]) < Math.floor(actualZoom)) {
					zoom(null, i);
					break;
				}		
			}
		};
		
		$this.each(function(index, element) {
			init.apply(element, [index, element, options]);
			return false;
		});
	
		return $this;
  	}
	
	var init = function(index, input, options) {
		
		isSVG = options.isSVG;
		info = options.infoArea;
		imagesPath = options.imagesPath;
		exportDialog = options.exportDialog;
		publishDialog = options.publishDialog;
		showGrid = options.showGrid || false;
		snapToGrid = options.snapToGrid || false;
		gridSize = options.gridSize || 10;
		gridPosition = options.gridPosition || [0, 0];
		mapImage = new Image();
		
		var passedImage = options.image;
		var passedAreas;

		if (isSVG) {
			$canvas = $('<div id="canvas">');
			$canvas.append(passedImage);
	
			var $svg = $canvas.find('svg');
			
			passedAreas = getAreasFromSVG($svg);
			
			//Detect if normal SVG or embedded image and areas
			if ($svg.is('.gen-by-synoptic-designer')) {
				isSVG = false;
				passedImage = $svg.find('image').attr('xlink:href');
			} else {
				resize();
				if (options.onSuccess)
					options.onSuccess(true);
			}
		} 

		$this.trigger('canvasAreaDraw.telemetry', {
			action: 'import', 
			isSVG: isSVG, 
			shapes: (passedAreas ? passedAreas.areas.length : 0)
		});
		
		if (!isSVG) {
			$canvas = $('<canvas id="canvas">');
			setCursor();
			ctx = $canvas[0].getContext('2d');

			if (options.anonymous)
				mapImage.crossOrigin = 'Anonymous';
			$(mapImage).on('load', function(){
				
				resize();
				getPixels();
				if (options.onSuccess)
					options.onSuccess(false);
					
			}).on('error', function(e){
				reset();
				if (options.onError)
					options.onError();
			});
			mapImage.src = passedImage;
			if (mapImage.loaded) {
				resize();
				getPixels();
				if (options.onSuccess)
					options.onSuccess(false);
			}
		}
		$this.prepend($canvas);

		resetInfoArea();
		
		if (passedAreas) 
			setAreas(passedAreas);
		
		$menu = $('<div class="contextmenu"><ul><li data-action="delete">' + (isSVG ? 'Unbind area' : 'Delete area') + '</li></ul>' + (isSVG ? '' : '<div class="note">Right click on single <br>anchor to delete it</div>') + '</div>').appendTo($this);

		$(document).on('focus', info + ' input, ' + info + ' textarea', function(){
			var s = parseInt($(this).parent('div').attr('id').replace('shape', ''));
			activeShape = s;
			
			if (isSVG) {
				$canvas.find('.area').removeClassSVG('active');
				$canvas.find('#' + shapes[s]).addClassSVG('active');
				console.log('#' + shapes[s]);
			}
			
			draw();
			update(false);
		});
		
		$(document).on('keydown', function(e) {
			
			if ($('input, textarea, select').is(':focus')) return;
			
			var keycode = (e.keyCode ? e.keyCode : e.which);
			var n = 5 * (e.shiftKey ? 4 : 1);
			var xy;
			
			switch (keycode) {
				case 37: //<
					xy = [-1*n, 0];
					break;
					
				case 39: //>
					xy = [n, 0]
					break;
					
				case 38: //^
					xy = [0, -1*n]
					break;
					
				case 40://v
					xy = [0, n]
					break;
                
                default:
                    return;
			}
			
			if (activeShape > -1) {
				var points = shapes[activeShape];
				
				for(var i = 0; i < points.length; i+=2) {
					if (snapToGrid) {
						points[i] = ((parseInt(points[i]) + xy[0]) / gridSize) * gridSize + gridPosition[0];
						points[i+1] = Math.round((parseInt(points[i+1]) + xy[1]) / gridSize) * gridSize + gridPosition[1];
					} else {
						points[i] = Math.round(parseInt(points[i]) + xy[0]);
						points[i+1] = Math.round(parseInt(points[i+1]) + xy[1]);
					}
				}
			} else {
				ctx.translate(xy[0], xy[1]);
			}
			draw();
			
		});

		$(document).on('change', info + ' .coords', function() {
			
			var s = parseInt($(this).parent('div').attr('id').replace('shape', ''));		
			if ($(this).val().length) {
				shapes[s] = $(this).val().split(',').map(function(point) {
					return (isNaN(point) ? false : parseInt(point));
				}).filter(Boolean);
			} else {
				shapes[s] = [];
			}
			draw();
			update();
		});
		
		$(document).on('change', info + ' .binding', function() {
			$(this).data('auto', ($(this).val() != '' ? '0' : '1'));
		});
		
		$(document).on('keypress', info + ' input', function(e){
			var keycode = (e.keyCode ? e.keyCode : e.which);
    		if(keycode == '13') draw();
		});

		$(document).on('click', info + ' .trash, ' + info + ' .binder', function(e){
			e.preventDefault();
			
			var $p = $(this).parent('div');
			var s = parseInt($p.attr('id').replace('shape', ''));
			
			if (isSVG) {
				if ($(this).is('.disabled')) return false;

				var isSel = $(this).is('.selected');
				if (isSel) {
					$(this).removeClass('selected');
					$p.removeClass('active').addClass('excluded');
					removeShape(s);
				} else {
					$(this).addClass('selected');
					$p.removeClass('excluded');
					$canvas.find('#' + shapes[s]).removeClassSVG('excluded');
				}
				
				var traverse = function(t){
					$('.child' + t).each(function(){
						var c = parseInt($(this).attr('id').replace('shape', ''));
						if (isSel) {
							$(this).find('.binder').removeClass('selected').addClass('disabled');
							$(this).addClass('excluded');
							$canvas.find('#' + shapes[c]).addClassSVG('excluded');

						} else {
							$(this).removeClass('excluded');
							$(this).find('.binder').removeClass('disabled').addClass('selected');
							$canvas.find('#' + shapes[c]).removeClassSVG('excluded');
						}
						
						traverse(c);
					});
				};
				traverse(s);
				
				
			} else {
				if (confirm('Are you sure to delete area ' + (s+1) + '?')){	
					removeShape(s);
					
					draw();
					update();
				}
			}
		});
		
		$('.contextmenu li').on('click', function(e){
			e.preventDefault();
			if (activeShape >= 0) {
				if ($(this).data('action') == 'delete') {
					removeShape(activeShape);
				}
				draw();
				update();
			}
			$('.contextmenu').hide(100);
		});
	
		$canvas.on('mouseout', mouseOut);
		$canvas.on('mousedown', mouseDown);
		$canvas.on('contextmenu', rightClick);
		$canvas.on('mouseup', stopMove);
		$canvas.on('mousewheel', mouseWheel);
		$(window).on('resize', function(){
			if ($this.is(':visible'))
				resize();
		});
		
		window.onbeforeunload = function() { return '';}
	}
	
	var reset = function(){
		
		$(document).off('click');
		$(document).off('keypress');
		$(document).off('change');
		$(document).off('change');
		$(document).off('focus');
		$(document).off('keydown');
		$('.contextmenu').remove();
		$('#canvas').remove();
		resetInfoArea();
		activeShape = -1;
		activePoint = -1;
		createNewShape = false;
		autoCreateNewShape = false;
		shapes = [];
		shapes.length = 0;
		canvasPoint = null;
		shapePoints = null;
		$canvas = null;
		
		
	};
	
	var infoOffset = 122;
	var resize = function() {
		
		var bottomOffset = 60;
		if (isSVG) {
			var $svg = $canvas.find('svg');
			$svg.attr({
				'width': '100%',
				'height': '100%'
			});
			$canvas.css({
				'height': $this.height() - bottomOffset
			});
		} else {
			w = mapImage.width;
			h = mapImage.height;
			
			$canvas.attr({
				'width': Math.max($this.width(), w),
				'height': $this.height() - bottomOffset 
			});
		}

		
		$(info + ' aside').css('height', $canvas.height() - infoOffset);
		
		trackTransforms(ctx);
		resetZoom();

		draw();
	};
	
	var resetInfoArea = function() {
		
		if (info && $canvas) {
			
			$(info).toggleClass('svg', isSVG);
			$(info).html('');
			
			/*if (isSVG) 
				$(info).append('<div class="filter"><input type="checkbox" id="filter" name="filter"> <label for="filter">Hide excluded</label></div>');
			*/	
			$(info).append('<aside><em>No area defined yet, click on the map image to add new.</em></aside>');
			$(info + ' aside').css('height', $canvas.height() - infoOffset);
			
			$(info).append('<a href="#" id="export" class="btn disabled" download>Export to Power BI</a> <a href="#" id="publish" class="btn">Submit to Gallery</a>');
			$(exportDialog).jqm();
			$(publishDialog).jqm();

			$('#export').on('click', function(e){
				if (!$(this).hasClass('disabled')) {
				
					

					var is_iedge = (/MSIE/i.test(navigator.userAgent) || 
									/rv:11.0/i.test(navigator.userAgent) || 
									/Edge\/\d./i.test(navigator.userAgent));

					if (is_iedge) {

						
					} else {
						var dataURL = getMap(false, true);
						console.log(dataURL)
						$(this)[0].href = dataURL

					}
					
					$(exportDialog).jqmShow(); 
				}
			});
			$('#publish').on('click', function(e){
				e.preventDefault();
				
				$(publishDialog + ' .thumbnail img').attr('src', getThumbnail());
				$(publishDialog).jqmShow();
			});
			
			
		}
	};

    var changeMap = function(passedImage, anonymous) {
        
        $(mapImage).off('load').off('error');
        
        if (anonymous)
			mapImage.crossOrigin = 'Anonymous';
            
		$(mapImage).on('load', function(){
            resize();
            getPixels();
					
		});
		mapImage.src = passedImage;
        if (mapImage.loaded) {
            resize();
            getPixels();
        }
    };

	var getSVGName = function(node) {
		
		var name = '';
		if (!node.id || node.id.indexOf('XMLID_') == 0) {
			if ((node.tagName.toLowerCase() == 'text'))
				name = node.textContent;
		} else {
			name = node.id.replace(/_x([A-Za-z0-9-:.]{2})_/g, function(m, m1){
				return String.fromCharCode(parseInt(m1, 16));
			}).replace(/_/g, ' ');

		}
		return name;
	};

	var getAreasFromSVG = function($svg) {
		
		var areas = [];
		
		var recogShapes = 'g, path, rect, circle, ellipse, line, polygon, polyline, text';
		
		var index = -1;
		var traverse = function(el, indent, parentIndex, parentIncluded) {
			var $children = $(el).children(recogShapes);
			$children.each(function(){
				
				index++;
		
				if (!this.id)
					$(this).attr('id', this.tagName.toUpperCase() + '_' + (index+1));
				
				var name = getSVGName(this);
				var title = this.getAttribute('title');
				
				var coords;
				var points = $(this).attr('points');
				if (points)
					coords = points.replace(/ ,|, /, ',').split(/,| /);
				
				if ($(this).is('#_x5F_ignored') || $(this).is('#_ignored')) return true;

				var isExcluded = $(this).is('.excluded') || $(this).is('#_x5F_excluded') || $(this).is('#_excluded');
				
				$(this).addClassSVG('area');
				
				areas.push({
					id: this.id,
					parent: parentIndex,
					indent: indent,
					name: name,
					title: title,
					excluded: isExcluded,
					coords: coords
				});
				
				traverse(this, indent + 1, index, (parentIncluded || !isExcluded));
			});
		};
		traverse($svg, 0, index, false);

		return { areas: areas };
	};

	var getAreasJSONString = function(anonymize) {
		
		if (isSVG) return '';
		
		var bigStr = '{"areas":[';
		for (var s = 0; s < shapes.length; s++) {
			var desc = $(info + ' #shape' + s + ' .binding').val();
			if (desc == '') desc = (s + 1).toString();
			
			var title = $(info + ' #shape' + s + ' .title').val();
			
			if (s > 0) bigStr += ',';
			bigStr += '{"name":' + (anonymize ? s + 1 : JSON.stringify(desc)) + ',';
			if (!anonymize) bigStr += '"title" : ' + JSON.stringify(title) + ',';
			bigStr += '"coords":[';
			for (var i = 0; i < shapes[s].length; i+=2) {
				if (i > 0) bigStr += ',';
				bigStr += '[' + shapes[s][i] + ',' + shapes[s][i+1] + ']';
			}
			bigStr += ']}';
		}
		bigStr += ']}';
		
		return bigStr;
	};
	

	var setAreas = function(jsonData) {
		var json;
		if (jsonData) {
			if (typeof(jsonData) === 'object')
				json = jsonData;
			else
				json = JSON.parse(jsonData);
		
			for (var a = 0; a < json.areas.length; a++) {
				var area = json.areas[a];
				var value;
				if (isSVG)
					value = area.id;
				else
					value = area.coords.reduce(function(a, b) {return a.concat(b);}, []);
				
				addShape();
				shapes[activeShape] = value;
				$('#shape' + activeShape + ' .binding').val(area.name).data('auto', '0');
				if (area.title)
					$('#shape' + activeShape + ' .title').val(area.title);
					
				if (area.indent > 0) {
					$('#shape' + activeShape).css('padding-left', (area.indent * 20) + 'px').addClass('indented');
					$('#shape' + activeShape + ' .txt').css('width', 160 - (area.indent * 20) + 'px');
				}
				
				if (area.parent >= 0)
					$('#shape' + activeShape).addClass('child' + area.parent);
				
				if (area.excluded) {
					$('#shape' + activeShape).addClass('excluded');
					$('#shape' + activeShape + ' .binder').removeClass('selected').addClass('disabled');
				}
			}
			draw();
			activeShape = -1;
			update();
		}
	};
	
	var setCursor = function(cursor) {
		var classes = ['default', 'crosshair', 'magicwand', 'grab', 'grabbing'];
		if (typeof(cursor) === 'undefined' || !cursor) 
			cursor = currentTool;

		if (cursor) {
			for (var i=0; i < classes.length; i++) {
				var c = classes[i];
				if (cursor == c)
					$canvas.addClass(c);
				else 
					$canvas.removeClass(c);
			}
		}
	};
	
	var shapeDefaultName = function(shape){
		
		var autoDesc = shape + 1;
		if (shape > 0){
			var lastShapeField = $('#shape' + (shape-1) + ' .binding');
			if (lastShapeField.length > 0) {
				var lastDesc = lastShapeField.val();
				var num = parseInt(lastDesc.replace(/^\D+/g, ''));
				if (num > 0)
					autoDesc = lastDesc.replace(num, num+1);
			}
		}
		return autoDesc;
	};

	var addShape = function() {
		
		shapes.push([]);
		activeShape = shapes.length - 1;
		
		$(info + ' aside em').hide();
		$('#export').removeClass('disabled');
		$(info + ' aside').append('<div id="shape' + activeShape + '" class="active">' + (isSVG ? '<div class="crumb"></div>' : '') + '<input type="text" class="binding txt" placeholder="Area name (to bind)" value="' + shapeDefaultName(activeShape) + '" data-auto="1"> &nbsp;' + (isSVG ? '<a href="#" class="action-btn binder selected" title="Include/Exclude area from data binding">BIND</a>' : '<a href="#" class="action-btn trash" title="Delete area"><img src="' + imagesPath + 'remove.svg" width="17" height="17"></a>') + '<br><input type="text" class="title txt" placeholder="Area name (to display)" value="">' + (isSVG ? '' : '<textarea class="coords"></textarea>') + '</div>');
		
	};
	
	var removeShape = function(index){
	
		activeShape = -1;
		activePoint = -1;
		
		if (isSVG) {
			
			$canvas.find('#' + shapes[index]).removeClassSVG('active').addClassSVG('excluded');
			
			
		} else {
			
			if (index == -1 || shapes.length == 1 || index >= shapes.length ) {
				//Remove all
				shapes.length = 0;
				resetInfoArea();
				if (index == -1)
					resetZoom();
				
			} else {
				
				//Remove single
				shapes.splice(index, 1);	
				
				$(info + ' #shape' + index).remove();
				
				$(info + ' div').each(function(idx, element) {
					$(this).attr('id', 'shape' + idx);
					var $desc = $(this).find('.binding');
					if ($desc.data('auto') == '1') 
						$desc.val(shapeDefaultName(idx));
				});	
			}
		}
	};
	
	var getPixels = function() {
		var $canvas2 = $('<canvas>');
		$canvas2.attr('width', mapImage.width).attr('height', mapImage.height); 
		var ctx2 = $canvas2[0].getContext('2d');
		ctx2.drawImage(mapImage, 0, 0);
		imageColors = ctx2.getImageData(0, 0, mapImage.width, mapImage.height);	
	};
	
	var oldAreasToPolygons = function(json) {
		
		var polys = '';
		for (var s = 0; s < json.areas.length; s++) {
			var area = json.areas[s];
			var name = area.name;
			if (name == '') name = (s + 1).toString();

			var points = area.coords.join(',');
			polys += '<polygon id="' + getLegalId(name) + '" points="' + points + '" />';
		}
		return polys;
	};
	
	var getLegalId = function(str) {
		//Old code
		/*var returnStr = str.replace(/([^A-Za-z0-9[\]{}_.:-])\s?/g, '_');
		if (!isNaN(parseInt(returnStr, 10))) 
			returnStr = '_' + returnStr;
		return returnStr;
		*/
		
		let returnId = str.replace(/[^A-Za-z0-9-:.]/g, function(m) {
			if (m == ' ') return '_';
			return "_x" + m.charCodeAt(0).toString(16).toUpperCase() + '_';
		});
		if (!isNaN(parseInt(returnId)))
			returnId = '_x' + returnId.substr(0, 1).charCodeAt(0).toString(16).toUpperCase() + '_' + returnId.substr(1);

		return returnId;
	};
	
	var getMap = function(anonymize, base64) {
		
		var svg = '';
		if (isSVG) {
			
			for (var s = 0; s < shapes.length; s++) {
				var name = $(info + ' #shape' + s + ' .binding').val();
				if (name == '' || anonymize) name = (s + 1).toString();
 
				var title = $(info + ' #shape' + s + ' .title').val();
				$canvas.find('#' + shapes[s]).attr('id', getLegalId(name)).attr('title', title); 
				shapes[s] = name;
			}
		
			svg = $canvas.html(); //$canvas.find('svg')[0].outerHTML; //Don't work in IE/Edge

		} else {
			
			svg = '<svg version="1.1" id="Map" class="gen-by-synoptic-designer" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + w + ' ' + h + '" xml:space="preserve"><image width="' + w + '" height="' + h + '" xlink:href="' + mapImage.src + '" />';
			
			for (var s = 0; s < shapes.length; s++) {
				var name = $(info + ' #shape' + s + ' .binding').val();
				if (name == '' || anonymize) name = (s + 1).toString();

				var title = $(info + ' #shape' + s + ' .title').val();
				
				var points = shapes[s].join(',');
				svg += '<polygon id="' + getLegalId(name) + '" title="' + title + '" points="' + points + '" />';
			}
			
			svg += '</svg>';
		}

		if (base64)
			return 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(svg)));
		else
			return svg;
	};
	
	var getThumbnail = function(){
		
		if (isSVG) {
			return getMap(true, true);
			
		} else {
			var format = 'jpeg';
			var quality = 0.6;
			
			var scale = 1;
			var maxWidthAllowed = 900;
			if (mapImage.width > maxWidthAllowed)
				scale = maxWidthAllowed / mapImage.width;
			
			var $canvas2 = $('<canvas>');
			$canvas2.attr('width', mapImage.width).attr('height', mapImage.height);
	
			var ctx2 = $canvas2[0].getContext('2d');
			draw(ctx2);
			
			if (format == 'jpeg') {
				ctx2.globalCompositeOperation = 'destination-over';
				ctx2.fillStyle = '#ffffff';
				ctx2.fillRect(0, 0, mapImage.width, mapImage.height);
			}
			
			
			if (scale >= 1) {
				return $canvas2[0].toDataURL('image/' + format, quality);
			} else {
				var scaledW = mapImage.width * scale;
				var scaledH = mapImage.height * scale;
				var $canvas3 = $('<canvas>');
				var ctx3 = $canvas3[0].getContext('2d');
				$canvas3.attr('width', scaledW).attr('height', scaledH);
				ctx3.drawImage($canvas2[0], 0, 0, scaledW, scaledH);
				return $canvas3[0].toDataURL('image/' + format, quality);
			}
		}
	};
	
	//Drawing canvas
	var draw = function(passedContext) {
		if (isSVG) return;
	
		var hasCustomContext = (typeof(passedContext) !== 'undefined');
		var context = (hasCustomContext ? passedContext : ctx);
		
		if (!hasCustomContext) {
			context.save();
			context.setTransform(1,0,0,1,0,0);
			context.clearRect(0,0,context.canvas.width,context.canvas.height);
			context.restore();
		}
		
		$.each(shapes, function(index, value) {
			context.globalCompositeOperation = 'destination-over';
			var points = value;
			if (points.length >= 2) {
		
				context.fillStyle = '#ffffff';
				context.strokeStyle = '#ffc200'; 
				context.lineWidth = 2;
				
				context.beginPath();
				context.moveTo(points[0], points[1]);
				var minX = points[0], maxX = points[0], minY = points[1], maxY = points[1];
				for (var i = 0; i < points.length; i+=2) {
					
					minX = Math.min(minX, points[i]);
					maxX = Math.max(maxX, points[i]); 
					minY = Math.min(minY, points[i+1]);
					maxY = Math.max(maxY, points[i+1]); 
					
					context.fillStyle = (i == activePoint && index == activeShape ? '#ffc200' : '#ffffff');
					
					context.fillRect(points[i]-2, points[i+1]-2, 4, 4);
					context.strokeRect(points[i]-2, points[i+1]-2, 4, 4);
					if (points.length > 2 && i > 1) {
						context.lineTo(points[i], points[i+1]);
					}
				}
				context.closePath();
				
				context.fillStyle = (!hasCustomContext && index == activeShape ? 'rgba(254,210,71,0.7)' : 'rgba(254,210,71,0.3)');
				context.fill();
				context.stroke();
	
				if (points.length > 2*2) {
					
					context.globalCompositeOperation = 'source-over';
					var title = $(info + ' #shape' + index + ' .title').val();
					var name = $(info + ' #shape' + index + ' .binding').val();
					var text = (title != '' ? title : (name != '' ? name : index + 1));
					
					context.fillStyle = '#856c25';
					
					var baseFont = 16;
					var metrics;
					do {
						context.font = 'bold ' + baseFont + 'px Open Sans';
						metrics = context.measureText(text);
						baseFont--;
					} while (metrics.width > maxX - minX);
					
					context.fillText(text, minX + ((maxX - minX) / 2) - (metrics.width / 2), minY + ((maxY - minY) / 2) + 6);
				}
			}
		});

		context.globalCompositeOperation = 'destination-over';
		
		if (!hasCustomContext && showGrid) gridline();
		
		context.drawImage(mapImage, 0, 0);
	};
	
	//On Mouse Wheel
	var mouseWheel = function(e) {
		if (e) e.preventDefault();	
		zoom(e);
	};
	var resetZoom = function() { 
		zoom(null, 6);
	};
	var zoom = function(e, z){
		var scaleFactor = 1.1;
		
		if (z == 6) {
			actualZoom = 100;
			if (isSVG) {
				//TODO
			} else {
				ctx.setTransform(1,0,0,1,0,0);
			}
			actualW = w;
			actualH = h;
			draw();
			
		} else {
			var scale;
			var pt;
			if (e) {
				if(!e.offsetX) {
					e.offsetX = (e.pageX - $(e.target).offset().left);
					e.offsetY = (e.pageY - $(e.target).offset().top);
				}
				if (isSVG)
					pt = {x: e.offsetX, y: e.offsetY};
				else
					pt = ctx.transformedPoint(e.offsetX, e.offsetY);
				scale = Math.pow(scaleFactor, e.deltaY);
				
			} else {
				if (isSVG)
					pt = {x: w/2, y: h/2};
				else
					pt = ctx.transformedPoint(w/2, h/2);
				scale = ((availableZooms[z] * w) / actualW) / 100;
			}

			actualZoom = (actualW * scale / w) * 100;
			
			if (actualZoom.toFixed(3) != Math.floor(actualZoom))
				actualZoom = actualZoom.toFixed(1);
			else
				actualZoom = parseInt(actualZoom);
			
			if (actualZoom > availableZooms[availableZooms.length - 1]) {
				scale = ((availableZooms[availableZooms.length - 1] * w) / actualW) / 100;
				actualZoom = availableZooms[availableZooms.length - 1];
			} else if (actualZoom < availableZooms[0]) {
				scale = ((availableZooms[0] * w) / actualW) / 100;
				actualZoom = availableZooms[0];
			}
			actualW *= scale;
			actualH *= scale;
			
			if (isSVG) {
				
			} else {
				ctx.translate(pt.x,pt.y);
				ctx.scale(scale, scale);
				ctx.translate(-pt.x,-pt.y);
			}
			
			draw();
		}
		
		$this.trigger('canvasAreaDraw.zoom', actualZoom);
	};
	
	var prepareToMoveCanvas = function() {
		activeShape = -1;
		
		grabbingTimeout = setTimeout(function(){
			$this.trigger('canvasAreaDraw.grabstart');
			setCursor('grab');
			$canvas.off('mousemove').on('mousemove', moveCanvas);
			setTimeout(function(){
				if (canvasPoint)
					setCursor('grabbing');
			}, 100);
		}, 100);	
	};
	
	//On Mouse Move (single anchor)
	var moveAnchor = function(e) {
	
		if (isSVG) return false;
		
		if (activeShape >= 0) {
			setCursor('default');

			createNewShape = false;
			autoCreateNewShape = false
			
			var points = shapes[activeShape];
			
			if(!e.offsetX) {
				e.offsetX = (e.pageX - $(e.target).offset().left);
				e.offsetY = (e.pageY - $(e.target).offset().top);
			}
			
			var pt = ctx.transformedPoint(e.offsetX, e.offsetY);
			
			if (snapToGrid) {
				points[activePoint] = Math.round(pt.x / gridSize) * gridSize + gridPosition[0];
				points[activePoint+1] = Math.round(pt.y / gridSize) * gridSize + gridPosition[1];
			} else {
				points[activePoint] = Math.round(pt.x);
				points[activePoint+1] = Math.round(pt.y);
			}
			draw();
		}
	};

	//On Mouse Move (shape)	
	var moveShape = function(e){
		
		if (isSVG) return false;
		
		if (shapePoints && canvasPoint) {
			
			createNewShape = false;
			autoCreateNewShape = false;
			
			var points = shapes[activeShape];
			
			if(!e.offsetX) {
				e.offsetX = (e.pageX - $(e.target).offset().left);
				e.offsetY = (e.pageY - $(e.target).offset().top);
			}
	
			var pt = ctx.transformedPoint(e.offsetX, e.offsetY);
			for(var i = 0; i < shapePoints.length; i+=2) {
				if (snapToGrid) {
					points[i] = Math.round((pt.x-canvasPoint.x) / gridSize) * gridSize + gridPosition[0]  + shapePoints[i];
					points[i+1] = Math.round((pt.y-canvasPoint.y) / gridSize) * gridSize + gridPosition[1] + shapePoints[i+1];
				} else {
					points[i] = Math.round(pt.x-canvasPoint.x) + shapePoints[i];
					points[i+1] = Math.round(pt.y-canvasPoint.y) + shapePoints[i+1];
				}
			}
			
			draw();
		}
	};
	
	//On Mouse Move (canvas)	
	var moveCanvas = function(e){
	
		if (canvasPoint) {
			
			createNewShape = false;
			autoCreateNewShape = false;

			if(!e.offsetX) {
				e.offsetX = (e.pageX - $(e.target).offset().left);
				e.offsetY = (e.pageY - $(e.target).offset().top);
			}
			if (isSVG) {
				//TODO
			} else {
				var pt = ctx.transformedPoint(e.offsetX, e.offsetY);
				ctx.translate(pt.x-canvasPoint.x, pt.y-canvasPoint.y);
				draw();
			}
		}
	};
	
	//On Mouse Move (global)
	var mouseMove = function(e){
		
		if (isSVG) return false;
		
		if (currentTool != 'grab') {
			if(!e.offsetX) {
				e.offsetX = (e.pageX - $(e.target).offset().left);
				e.offsetY = (e.pageY - $(e.target).offset().top);
			}
		
			var pt = ctx.transformedPoint(e.offsetX, e.offsetY);
			for (var s = 0; s < shapes.length; s++) {
				if (isPointInPoly(shapes[s], pt)) {
					
					setCursor('default');
					return false;
				}
			}
			setCursor();
		}
	};
	
	//On Mouse Out
	var mouseOut = function(){
		createNewShape = false;
		autoCreateNewShape = false;
		activePoint = -1;
		canvasPoint = null;
		shapePoints = null;
		clearTimeout(grabbingTimeout);
		$this.trigger('canvasAreaDraw.grabend');
		$this.trigger('canvasAreaDraw.selectend');
		setCursor();
		$canvas.off('mousemove');
	};
	
	//On Mouse Up
	var stopMove = function(e) {
		
		//Don't allow to move canvas
		clearTimeout(grabbingTimeout);
		$this.trigger('canvasAreaDraw.grabend');
		$this.trigger('canvasAreaDraw.selectend');
		setCursor();
		
		if (isSVG) return false;
		
		$canvas.off('mousemove').on('mousemove', mouseMove);
		
		//Create new shape
		if (createNewShape) {
			createNewShape = false;
			addShape();
			
			var points = shapes[activeShape];
			
			if (snapToGrid)
				points.splice(0, 0, Math.round(canvasPoint.x / gridSize) * gridSize + gridPosition[0], Math.round(canvasPoint.y / gridSize) * gridSize + gridPosition[1]);
			else
				points.splice(0, 0, Math.round(canvasPoint.x), Math.round(canvasPoint.y));
			
		} else if (autoCreateNewShape) {
			
			autoCreateNewShape = false;
			
			if (!isMarching) {
				isMarching = true;
				var points = magicWand(parseInt(canvasPoint.x), parseInt(canvasPoint.y));
				if (points.length > 0) {
					addShape();
					shapes[activeShape] = points;
					draw();
					update();
				}
				isMarching = false;
			}
			
		} else if (activeShape >= 0) {
			
			
			if(!e.offsetX) {
				e.offsetX = (e.pageX - $(e.target).offset().left);
				e.offsetY = (e.pageY - $(e.target).offset().top);
			}
			var pt = ctx.transformedPoint(e.offsetX, e.offsetY);
			if (isPointInPoly(shapes[activeShape], pt)) {
				setCursor('default');
			}
		}
		
		
		draw();
		update();
		activePoint = -1;
		canvasPoint = null;
		shapePoints = null;
	};
		
	//On Right Click
	var rightClick = function(e) {
	  e.preventDefault();
	  
	  if (currentTool != 'grab') { 
		  
	  	setCursor('default');
		
		for (var s = 0; s < shapes.length; s++) {
			
			var isInPoly = false;
			
			if (isSVG) {
				
				var elementId = e.target.id;
				var $group = $(e.target).closest('g');
				if (!elementId && $group.length > 0) 
					elementId = $group.attr('id');
					
				if (elementId)
					isInPoly = (shapes[s] == elementId);
				
			} else {
				
				if(!e.offsetX) {
					e.offsetX = (e.pageX - $(e.target).offset().left);
					e.offsetY = (e.pageY - $(e.target).offset().top);
				}
				var pt = ctx.transformedPoint(e.offsetX, e.offsetY);
		
				for (var i = 0; i < shapes[s].length; i+=2) {
					var dis = Math.sqrt(Math.pow(pt.x - shapes[s][i], 2) + Math.pow(pt.y - shapes[s][i+1], 2));
					if (dis < 4) {
						$(".contextmenu").hide(100);
						activeShape = s;
						shapes[s].splice(i, 2);
						if (shapes[s].length == 0)
							removeShape(s);
		
						draw();
						update();
						
						return false;
					}
				}
				
				isInPoly = isPointInPoly(shapes[s], pt);
			}
			
			if (isInPoly) {
				activeShape = s;
				$(".contextmenu").finish().toggle(100).
				css({
					top: (e.pageY + 4) + "px",
					left: (e.pageX + 4) + "px"
				});
				draw();
				update();
				
				return false;
			}
		}
		
	  }
	  $(".contextmenu").hide(100);
	  return false;
	};
	
	//On Mouse Down
	var mouseDown = function(e) {
		
		if (e.which === 3) return false; //Right button
		
		if ($(e.target).parents('.contextmenu').length == 0 && !$('.contextmenu').is(':hidden')) {
			$('.contextmenu').hide(100);
			return false;
		}
		
		e.preventDefault();
		
		
		if (isSVG) {
			
			if (currentTool == 'grab') {
				
				//TODO
				
			} else {
				
				var elementId = e.target.id;
				/*var $group = $(e.target).closest('g');
				if (!elementId && $group.length > 0) 
					elementId = $group.attr('id');
				*/
				if (elementId) {
					for (var s = 0; s < shapes.length; s++) {
						if (shapes[s] == elementId) {
		
							activeShape = s;
							$this.trigger('canvasAreaDraw.selectstart');
							$(info + ' input').blur();
							
							$canvas.find('.area').removeClassSVG('active');
							$canvas.find('#' + shapes[s]).addClassSVG('active');
				
							update();
							return false;
							
						}
					}
				}
				/*if ($(e.target).is('.excluded')) {
					addShape();
					shapes[activeShape] = elementId;

					$('#shape' + activeShape + ' .binding').val(getSVGName(e.target)).data('auto', '0');
					$('#shape' + activeShape + ' .title').val($(e.target).attr('title'));
					$canvas.find('.area').removeClassSVG('active');
					$(e.target).addClassSVG('area active');
					update();
				}*/
			}
			
		} else {
	
			var dis, lineDis, insertAt;
			var points;
			
			createNewShape = false;
			autoCreateNewShape = false;
			
			var currentShapePoints = (activeShape < 0 ? 4 : shapes[activeShape].length / 2);
			var canvasTouched = (currentShapePoints >= 4);

			if(!e.offsetX) {
				e.offsetX = (e.pageX - $(e.target).offset().left);
				e.offsetY = (e.pageY - $(e.target).offset().top);
			}
		
			var pt = ctx.transformedPoint(e.offsetX, e.offsetY);

		
			if (currentTool != 'grab') {
	
				if (currentShapePoints >= 3 || currentTool == 'default') {
					
					//Check if anchor point touched
					for (var s = 0; s < shapes.length; s++) {
						for (var i = 0; i < shapes[s].length; i+=2) {
							dis = Math.sqrt(Math.pow(pt.x - shapes[s][i], 2) + Math.pow(pt.y - shapes[s][i+1], 2));
	
							if ( dis < 4 ) {
								activeShape = s;
								activePoint = i;
								$this.trigger('canvasAreaDraw.selectstart');
								$canvas.off('mousemove').on('mousemove', moveAnchor);
								update();
								return false;
							}
						}
					}
	
	
					//Check if mouse inside a shape
					for (var s = 0; s < shapes.length; s++) {
						if (isPointInPoly(shapes[s], pt)) {
			
							var lastActive = activeShape;
							activeShape = s;
							points = shapes[s];
							canvasTouched = false;
							
							//if (currentTool == 'default') {
								shapePoints = points.slice(0);
								canvasPoint = pt;
								setCursor('default');
								$canvas.off('mousemove').on('mousemove', moveShape);
							//}
							
							//Just select
							if (activeShape != lastActive || currentTool != 'crosshair') {
								$this.trigger('canvasAreaDraw.selectstart');
								$(info + ' input, ' + info + ' textarea').blur();
								draw();
								update();
								
								return false;	
							}
							
							break;
						}
					}
				}
				
			}
			
			if (currentTool == 'crosshair') {
				
				//Continue to add anchor if fast clicks
				if (canvasTouched && activeShape >= 0) {	
					
					var minMs = 800;
					var now = new Date().getTime();
					var ms = (now - anchorLastTime);
					if (ms < minMs) 
						canvasTouched = false;
				}
	
				//Ready to create a new shape or move
				if (canvasTouched) {
	
					createNewShape = true;		
					canvasPoint = pt;
					prepareToMoveCanvas();
					return false;
				}
	
				//Add new anchor
				points = shapes[activeShape];
				insertAt = points.length;
				for (var i = 0; i < points.length; i+=2) {
					if (i > 1) {
						lineDis = dotLineLength(
							pt.x, pt.y,
							points[i], points[i+1],
							points[i-2], points[i-1],
							true
						);
						if (lineDis < 4) {
							insertAt = i;
						}
					}
				}
				
				if (snapToGrid)
					points.splice(insertAt, 0, Math.round(pt.x / gridSize) * gridSize + gridPosition[0], Math.round(pt.y / gridSize) * gridSize + gridPosition[1]);
				else
					points.splice(insertAt, 0, Math.round(pt.x), Math.round(pt.y));
					
				activePoint = insertAt;
				$canvas.off('mousemove').on('mousemove', moveAnchor);
					
				anchorLastTime = new Date().getTime();
				
				draw();
				update();
				
			} else {
				
				if (currentTool == 'magicwand')
					autoCreateNewShape = true;
	
				//move entire canvas
				canvasPoint = pt;
				prepareToMoveCanvas();
				
			}
		}
		
	  	return false;
	};
	
	//Update info panel
    var update = function(focus) {
		
		$(info + ' div').removeClass('active');
		if (activeShape >= 0) 
			$(info + ' #shape' + activeShape).addClass('active');
			
		if (!isSVG) {
			for (var s = 0; s < shapes.length; s++) {
				var points = shapes[s];
				$(info + ' #shape' + s + ' .coords').val(points.join(', '));
			}
		}
		
		if (typeof(focus) === 'undefined') focus = true;
		if (focus && $(info + ' div.active').length > 0)
			$(info + ' aside').scrollTop($(info + ' aside').scrollTop() -  $(info + ' aside').offset().top + $(info + ' div.active').offset().top - 10);
    };

	//Based on W. Randolph Franklin PNPOLY
	var isPointInPoly = function(points, pt){
	
		var poly = [];
		for (var i = 0; i < points.length; i+=2) {
			poly.push({x: points[i], y: points[i+1]});
		}
		
		for(var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
			((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
			&& (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
			&& (c = !c);
		return c;
	};
	
	//Copyright (c) 2015 - Daniele Perilli - daniele.perilli@gmail.com
	//Find possible areas based on color proximity
	var magicWand = function(x, y) {
		var dbg = false; //Debug mode

		var points = [];

		var matchColor = function(px, py){
			
			var firstPixel = ((y * w) + x) * 4;
			var pixel = ((py * w) + px) * 4;
		
			if (dbg) console.log('%c   ', 'background:rgba(' + imageColors.data[pixel] + ',' +  imageColors.data[pixel + 1] + ',' + imageColors.data[pixel + 2] + ',' + imageColors.data[pixel+3] + '); border:1px solid #ccc');
			
			return (firstPixel == pixel || (imageColors.data[pixel] == imageColors.data[firstPixel] && imageColors.data[pixel + 1] == imageColors.data[firstPixel + 1] && imageColors.data[pixel + 2] == imageColors.data[firstPixel + 2] && imageColors.data[pixel + 3] == imageColors.data[firstPixel + 3]));
		};

		//			Top,     Right,  Bottom, Left
		var dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]], dbgDirs = ['^', '>', 'v','<'];
	
		var d = 0; //Direction
		var xx = x, yy = y;
		var vx = NaN, vy = NaN; //First valid point xy
		
		var elapsed = 0, timeAtStart = (new Date()).getTime();

		do {
			
			var nd = d - 1;
			if (nd < 0) nd = (isNaN(vx) ? 0 : dirs.length - 1);

			for (var c = 0; c < dirs.length; c++) {
		
				var dxx = xx + dirs[nd][0];
				var dyy = yy + dirs[nd][1];
				var canvasEdgeReached = (dxx <= 0 || dxx >= w || dyy <= 0 || dyy >= h);

				if (matchColor(dxx, dyy) && !canvasEdgeReached) {
					if (dbg) console.log('= Same color at ' + dxx + ',' + dyy + ' (' + dbgDirs[nd] + ')');
					
					break;
					
				} else {
					if (dbg) console.log('~ Diff color at ' + dxx + ',' + dyy + ' (' + dbgDirs[nd] + ')');
				}
				
				nd++;
				if (nd >= dirs.length) nd = 0;
			}
			
			if (nd != d) {
				//Direction changed
				if (isNaN(vx)) {
					//Don't add the first point you found
					vx = xx;
					vy = yy;
				} else {
					if (dbg) console.log('+ Point at ' + xx + ',' + yy);

					points.push(xx);
					points.push(yy);
				}
				d = nd;
				
			} 
			
			xx += dirs[d][0];
			yy += dirs[d][1];
			if (dbg) console.log(dbgDirs[d] + ' Move to ' + xx + ',' + yy);
			
			elapsed = ((new Date()).getTime() - timeAtStart) / 1000; //Security check
			
		} while ((xx != vx || yy != vy) && (elapsed < 10));

		return points;

	};	
	
	//Gridline
	var gridline = function(){
		
		//ctx.globalCompositeOperation = 'source-over';

  		ctx.beginPath();
 		for (var x=0;x<=w;x+=gridSize){
    		ctx.moveTo(x-0.5+gridPosition[0],0);
    		ctx.lineTo(x-0.5+gridPosition[0],h);
  		}
  		for (var y=0;y<=h;y+=gridSize){
    		ctx.moveTo(0,y-0.5+gridPosition[1]);
    		ctx.lineTo(w,y-0.5+gridPosition[1]);
  		}
		ctx.closePath();
		ctx.strokeStyle = '#aaa';
		ctx.lineWidth = 0.25;
  		ctx.stroke();
	
	}
  
  	//Save canvas transformation
	var trackTransforms = function(ctx){
		
		if (!ctx) return;
		
		var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
		var xform = svg.createSVGMatrix();
		ctx.getTransform = function(){ return xform; };
		
		var savedTransforms = [];
		
		var save = ctx.save;
		ctx.save = function(){
			savedTransforms.push(xform.translate(0,0));
			return save.call(ctx);
		};
		var restore = ctx.restore;
		ctx.restore = function(){
			xform = savedTransforms.pop();
			return restore.call(ctx);
		};

		var scale = ctx.scale;
		ctx.scale = function(sx,sy){
			xform = xform.scaleNonUniform(sx,sy);
			return scale.call(ctx,sx,sy);
		};
		var rotate = ctx.rotate;
		ctx.rotate = function(radians){
			xform = xform.rotate(radians*180/Math.PI);
			return rotate.call(ctx,radians);
		};
		var translate = ctx.translate;
		ctx.translate = function(dx,dy){
			xform = xform.translate(dx,dy);
			return translate.call(ctx,dx,dy);
		};
		var transform = ctx.transform;
		ctx.transform = function(a,b,c,d,e,f){
			var m2 = svg.createSVGMatrix();
			m2.a=a; m2.b=b; m2.c=c; m2.d=d; m2.e=e; m2.f=f;
			xform = xform.multiply(m2);
			return transform.call(ctx,a,b,c,d,e,f);
		};
		var setTransform = ctx.setTransform;
		ctx.setTransform = function(a,b,c,d,e,f){
			xform.a = a;
			xform.b = b;
			xform.c = c;
			xform.d = d;
			xform.e = e;
			xform.f = f;
			return setTransform.call(ctx,a,b,c,d,e,f);
		};
		var pt  = svg.createSVGPoint();
		ctx.transformedPoint = function(x,y){
			pt.x=x; pt.y=y;
			return pt.matrixTransform(xform.inverse());
		}
	};

	var dotLineLength = function(x, y, x0, y0, x1, y1, o) {
		function lineLength(x, y, x0, y0){
			return Math.sqrt((x -= x0) * x + (y -= y0) * y);
		}
		if(o && !(o = function(x, y, x0, y0, x1, y1){
			if(!(x1 - x0)) return {x: x0, y: y};
			else if(!(y1 - y0)) return {x: x, y: y0};
			var left, tg = -1 / ((y1 - y0) / (x1 - x0));
			return {x: left = (x1 * (x * tg - y + y0) + x0 * (x * - tg + y - y1)) / (tg * (x1 - x0) + y0 - y1), y: tg * left - tg * x + y};
			}(x, y, x0, y0, x1, y1), o.x >= Math.min(x0, x1) && o.x <= Math.max(x0, x1) && o.y >= Math.min(y0, y1) && o.y <= Math.max(y0, y1))){
			var l1 = lineLength(x, y, x0, y0), l2 = lineLength(x, y, x1, y1);
			return l1 > l2 ? l2 : l1;
		} else {
			var a = y0 - y1, b = x1 - x0, c = x0 * y1 - y0 * x1;
			return Math.abs(a * x + b * y + c) / Math.sqrt(a * a + b * b);
		}
	};

	$.fn.addClassSVG = function(className){
		$(this).attr('class', function(index, existingClassNames) {
			
			var returnClass = '';
			if (typeof existingClassNames === 'undefined' || !existingClassNames) {
				returnClass = className;
			} else {
				
				returnClass = existingClassNames;
				var classes = className.split(' ');
				for (var i = 0; i < classes.length; i++) {
					var re = new RegExp('\\b' + classes[i] + '\\b', "i");
					if (!re.test(returnClass))
						returnClass += ' ' + classes[i];
				}
			}
			return returnClass.trim();
		});
		return this;
	};
	
	$.fn.removeClassSVG = function(className){
		$(this).attr('class', function(index, existingClassNames) {
			var returnClass = '';
			if (typeof existingClassNames !== 'undefined' && existingClassNames) {
	
				returnClass = existingClassNames;
				var classes = className.split(' ');
				for (var i = 0; i < classes.length; i++) {
					var re = new RegExp('\\b' + classes[i] + '\\b', "i");
					returnClass = returnClass.replace(re, '').trim();
				}
			}
			return returnClass;
		});
		return this;
	};
  
})( jQuery );

