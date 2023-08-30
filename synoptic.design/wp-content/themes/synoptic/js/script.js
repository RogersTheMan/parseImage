/*
 * Synoptic Design by SQLBI Script
 * Copyright (c) Daniele Perilli. All rigths are reserved.
 * http://synoptic.design	
 *
 * Depends on JQuery, JQuery UI, and other plugins - see plugin.js
 *
 *
*/

if (document.addEventListener)
	document.addEventListener("touchstart", function() {},false);

/* OnLoad */
$(document).ready(function () {

	var globalResize = function(){
		if ($('.container').length > 0) {
			$('.container').height($(window).height() - $('.container:visible').offset().top - 50);
		
			$('#polygon, #gallery ul').height($('.container').height());
		}
	};
	$(window).on('resize', globalResize);
	globalResize();
		
	$('.selectors a').on('click', function(e){
		e.preventDefault();
		$('.selectors a').not(this).removeClass('active');
		$(this).addClass('active');
		var containerId = '#' + $(this).data('container');
		$('.container').not(containerId).hide();
		$(containerId).show('fade', 'fast');
		globalResize();
	});
	
	//Editor
	var loadedFile = false;
	var canvasArea;
	var loadCanvas = function(image, isSVG, anonymous) {

		$('#tools, #shapeList').hide();

		if (isSVG && /(^ftp|^http(s)?):\/\//.test(image)) {
			$.get(image, function(d){
				loadCanvas(d, true, false);
			}, 'text');
			return;
		}
		
		canvasArea = $('#polygon').canvasAreaDraw({
			image: image,
			isSVG: isSVG, 
			anonymous: (typeof anonymous === "undefined" ? false: anonymous),
			infoArea: '#shapes',
			exportDialog: '#exportdiag',
			publishDialog: '#publishdiag',
			imagesPath: theme_url + 'images/',
			showGrid: $('#showGrid').is(':checked'),
			snapToGrid: $('#snapToGrid').is(':checked'),
			onError: function(){
				$('#uploader').show();
				$('#tools, #shapeList').hide();
				$('#polygon').removeClass('loading loaded');
				if ($('#polygonURL').val() != '')
					$('#polygonURL').addClass('error');
				
				loadedFile = false;
			},
			onSuccess: function(returnedIsSVG) {
				$('#polygonURL').removeClass('error');
				$('#polygon').removeClass('loading').addClass('loaded');
				
				var notSupportedTools = '#crosshair, #magicwand, #grab, #changeImage, #tools .gridgroup, #tools .zoomgroup';
				if (returnedIsSVG) {
					$(notSupportedTools).hide();
					$('#tools .toolmsg').html('<div class="table"><div class="cell">SVG editing is quite limited at the moment,  use a <a href="https://inkscape.org/en/download/" target="_blank" rel="nofollow" style="color:#000">grapich designer such as Inkscape</a> to modify this file.</div></div>').show();
					setTimeout(function(){
						$('#default').trigger('click');
					}, 1);
				} else {
					$(notSupportedTools).show();
					$('#tools .toolmsg').html('').hide();
					setTimeout(function(){
						$('#magicwand').trigger('click');
					}, 1);
				}
				$('#tools, #shapeList').show();
				loadedFile = true;
			}
		});
	};
	
	$('#polygon').filedrop({
	
		error: function(err, file) {

			$('#polygon').removeClass('active');
			switch(err) {
				case 'BrowserNotSupported':
					alert('Sorry, but your browser does not support drag and drop!');
					break;
				case 'TooManyFiles':
					alert('Sorry, but you drag just one file!');
					break;
				case 'FileTooLarge':
					alert('Sorry, but the file is too larger!');
					break;
				case 'FileTypeNotAllowed':
					alert('Sorry, but the file type is not allowed!');
					break;
				case 'FileExtensionNotAllowed':
					alert('Sorry, but the file type is not allowed!');
					break;
				default:
					break;
			}
		},
		allowedfiletypes: ['image/jpeg','image/png','image/gif', 'image/svg+xml'], 
		allowedfileextensions: ['.jpg','.jpeg','.png','.gif', '.svg'], 
		maxfiles: 1,
		maxfilesize: 20,    // max file size in MBs
		dragOver: function() {
			$('#polygon').addClass('active');	
		},
		dragLeave: function() {
			$('#polygon').removeClass('active');
		},
		beforeSend: function(file, i, done) {

			if (loadedFile) {
				if (confirm('Are you sure to replace the current image and areas?')) {
					canvasArea.reset();
				} else { 
					$('#polygon').removeClass('active');
					return false;
				}
			}	

			$('#uploader').hide();
			$('#polygon').removeClass('active loaded').addClass('loading');	
			
			var reader = new FileReader();
			var isSVG = (file.type.indexOf('image/svg') >= 0);
			if (isSVG)
				reader.readAsText(file);  
			else
				reader.readAsDataURL(file);  
				
			reader.onload = function() {
				loadCanvas(reader.result, isSVG, false);      
			};
		}
	});
		
	
	$('#showRemote').on('click', function(e){
		e.preventDefault();
		$('#remote').toggle('fade', 'fast', function(){
			$('#polygonURL').focus();
		});
		
	});
	
	$('#polygonURL').on('keyup',function(){
		$(this).removeClass('error');
	}); 
    
    var keepCanvas;
	var currentFile;

	$('#browseImage').on('click', function (e) {
   		e.preventDefault();
        keepCanvas = false;
		$('#file').trigger('click');
	});
	
    $('#changeImage').on('click', function(e){
		e.preventDefault();
        keepCanvas = true;
		$('#file').trigger('click');
	});
    
    $('#file').on('change', function () {
		if (this.files && this.files[0]) {
			currentFile = this.files[0];
			$('#polygonURL').val(currentFile.name);
			$('#getImage').trigger('click');
		}
	});
	
	$('#getImage').on('click', function(e){
		e.preventDefault();
		var url = $('#polygonURL').val();
		if (url != '') {
			$('#uploader').hide();
            if (!keepCanvas)
                $('#polygon').removeClass('loaded').addClass('loading');
			
			var isSVG = false;
			if (!/(ftp|http(s)?):\/\//.test(url) && currentFile) {
				var reader = new FileReader();
				isSVG = (currentFile.type.indexOf('image/svg') >= 0);
				if (isSVG)
					reader.readAsText(currentFile);
				else
					reader.readAsDataURL(currentFile);
					
				reader.onload = function () {
                    
                    if (canvasArea && keepCanvas && !isSVG)
                        canvasArea.changeMap(reader.result, false);
                    else
					   loadCanvas(reader.result, isSVG, false); 
				};
			} else {
				isSVG = (url.indexOf('.svg') >= 0);
                if (canvasArea && keepCanvas && !isSVG)
                    canvasArea.changeMap(url, true);
                else
				    loadCanvas(url, isSVG, true);
			}
		}
	});

	$('#showGrid').on('change', function(){
		if (canvasArea)
			canvasArea.toggleGrid($(this).is(':checked'));
	});
	
	$('#snapToGrid').on('change', function(){
		if (canvasArea)
			canvasArea.toggleSnap($(this).is(':checked'));
	});
	
	$('#increaseGrid').on('click', function(e){
		e.preventDefault();
		if (canvasArea) 
			canvasArea.changeGridSize(true);
	});
	$('#decreaseGrid').on('click', function(e){
		e.preventDefault();
		if (canvasArea) 
			canvasArea.changeGridSize(false);
	});
	
	$('#zoomin').on('click', function(e){
		e.preventDefault();
		if (canvasArea)
			canvasArea.zoomIn();
	});
	
	$('#zoomout').on('click', function(e){
		e.preventDefault();
		if (canvasArea)
			canvasArea.zoomOut();
	});
	$('#polygon').on('canvasAreaDraw.zoom', function(e, percentage){
		$('#zoomvalue').html(percentage + '%');
	});
	$('#polygon').on('canvasAreaDraw.grabstart', function(e){
		$('#grab').addClass('autoselected');
	});
	$('#polygon').on('canvasAreaDraw.grabend', function(e){
		$('#grab').removeClass('autoselected');
	});
	$('#polygon').on('canvasAreaDraw.selectstart', function(e){
		$('#default').addClass('autoselected');
	});
	$('#polygon').on('canvasAreaDraw.selectend', function(e){
		$('#default').removeClass('autoselected');
	});
	
	$('#polygon').on('canvasAreaDraw.telemetry', function(e, eventArgs){
		if (typeof ga !== 'undefined') {
			ga('send', 'event', eventArgs.action, 'design', (eventArgs.isSVG ? 'SVG' : 'Bitmap'), eventArgs.shapes);
		}
	});
	
	$('.actiongroup button').on('click', function(e){
		e.preventDefault();
		$('.actiongroup button').removeClass('selected');
		$(this).addClass('selected');
		canvasArea.changeTool($(this).attr('id'));
	});
	
	$('#reset').on('click', function(e){
		e.preventDefault();
		
		if (canvasArea) {
			if (confirm('Are you sure to remove current image and areas?')) {
				
				canvasArea.reset();
				$('#uploader').show();
				$('#tools, #shapeList').hide();
				$('#polygon').removeClass('loaded loading');
				$('#uploader form').get(0).reset();
				$('#publishform').show().get(0).reset();
				$('#publishfeedback').html('');
				loadedFile = false;
			}	
		}	
		
	});
	
	$.validator.messages.required = '';
	$('#bugdiag').jqm();
	$('#bugreport').on('click', function(e){
		e.preventDefault();
		
		$('#bugform').show();
		$('#bugform textarea').val('');
		$('#bugfeedback').hide();
		$('#bugdiag').jqmShow(); 
	});
	$("#bugform").validate({
		submitHandler: function(form) {
			
			setTimeout(function(){ 
				$(form).hide();
				$('#bugdiag').addClass('loading');
				$('#bugfeedback').hide();
			}, 100);
			
			$.ajax({
				type: "POST",
				url: $(form).attr('action'),
				data: $(form).serialize(),
				dataType: "text",
				complete: function(req, status) {
					
					$('#bugdiag').removeClass('loading');
					if (status != 'success')
						$(form).show();
						
					$('#bugfeedback').html(req.responseText).show('fade', 'fast');
				}
			});
			
			return false;
		}
	});
	
	$('.steps .nextstep').on('click', function(e){
		e.preventDefault();

		var idx = $(this).closest('.step').index('.step');
		$('.steps .step').each(function(index, element){
			if (index == idx + 1)
				$(this).show('fade', 'fast');
			else
				$(this).hide();
		});
		
	});
	
	$('.steps .prevstep').on('click', function(e){
		e.preventDefault();

		var idx = $(this).closest('.step').index('.step');
		if (idx > 0) {
			$('.steps .step').each(function(index, element){
				if (index == idx - 1)
					$(this).show('fade', 'fast');
				else
					$(this).hide();
			});
		}
		
	});
	
	$('#publishform').validate({
		submitHandler: function(form) {
			
			setTimeout(function(){ 
				$(form).hide();
				$('#publishdiag').addClass('loading');
				$('#publishfeedback').hide();
			}, 100);

			var formData = new FormData();
			formData.append('action', 'submit_to_gallery');
			formData.append('folder', $('#publish_folder').val());
			formData.append('title', $('#publish_title').val());
			formData.append('description', $('#publish_description').val());
			formData.append('name', $('#publish_name').val());
			formData.append('email', $('#publish_email').val());
            formData.append('g-recaptcha-response', $('#publishform #g-recaptcha-response').val());

			var ms = (new Date).getTime();
			var extRe = /\/([^(+|;)]*)/; 
			
			var thumb_blob = dataURLToBlob(canvasArea.getThumbnail());
			var thumb_ext = extRe.exec(thumb_blob.type);
			formData.append('thumb', thumb_blob, 'gallery_thumb_' + ms + '.' + thumb_ext[1]);
			
			var map = canvasArea.getMap($('#exclude_area_names').is(':checked'));
			if (map.indexOf('data:') == -1) {
				formData.append('map_url', map);
			} else {
				var map_blob = dataURLToBlob(map);
				var map_ext = extRe.exec(map_blob.type);
				formData.append('map', map_blob, 'gallery_map_' + ms + '.' + map_ext[1]);
			}
			
			$.ajax({
				url: $(form).attr('action'),
				type: 'POST',
				data: formData,
				cache: false,
				contentType: false,
				processData: false,
				dataType: 'text',
				complete: function(req, status) {
					$('#publishdiag').removeClass('loading');
					if (status != 'success')
						$(form).show();
						
					$('#publishfeedback').html(req.responseText).show('fade', 'fast');
				}
			});
			

			return false;
		}
	});
	
	$('#submissiondiag').jqm();
	
	$('#gallery .folders a').on('click', function(e){
		e.preventDefault();
		var folder = $(this).data('folder');
		$('#gallery .items li').not('.folder' + folder).hide();
		$('#gallery .items li.folder' + folder).show('fade', 'fast');
		$('#gallery .folders a').not(this).removeClass('active');
		$(this).addClass('active');
	});
	
	$('#gallery .submission a').on('click', function(e){
		e.preventDefault();
		var id = $(this).attr('id');
		var data = gallery_submissions[id];
		$('#submissiondiag img').attr('src', data.image);
		$('#submissiondiag h2').html(data.title);
		$('#submissiondiag p').html(data.content);
		$('#submissiondiag aside').html(data.status + '<br>' + data.author);
		$('#submissiondiag .btn').data('submission', id);
		if ($('#submissiondiag #editpost').length > 0)
			$('#submissiondiag #editpost').attr('href', data.edit);
		if ($('#submissiondiag #trashpost').length > 0)
			$('#submissiondiag #trashpost').attr('href', data.trash);
		$('#submissiondiag').jqmShow();
	});
	
	$('#editsubmission').on('click', function(e){
		e.preventDefault();
		$('#submissiondiag').jqmHide();
		$('#uploader').hide();
		$('#polygon').removeClass('active loaded').addClass('loading');	
		
		var data = gallery_submissions[$(this).data('submission')];
		loadCanvas(sanitizeGalleryURL(data.map), true, true);
		$('.selectors a:eq(0)').trigger('click');
	});
	
	//Newsletter
	$("#df-subscribe").on('change', function(){
		$(this).removeClass('error');
	});
	
	$("#df-subscribe").on('keypress', function(e){
		$(this).removeClass('error');
		if (e.which == 13){
			e.preventDefault();
			$("#df-subscribe-do").click();
		} 
	});
	
	$("#df-subscribe-do").on('click', function(e){
		e.preventDefault();
		var $input = $("#df-subscribe");
		if ($input.val() != '' && $input.val() != $input.attr('placeholder'))
			sqlbiSubscribe();
		else
			$input.focus();
	});
	
});
/* End OnLoad */

//File helper
function dataURLToBlob(dataURL) {
    var BASE64_MARKER = ';base64,';
	var pos = dataURL.indexOf(BASE64_MARKER);
    if (pos == -1 || pos > 25) {
		var re = /:([^,]+),((.|\n)+)/gm; 
		var m = re.exec(dataURL);
		if (m === null) return false;

        return new Blob([m[2]], {type: m[1]});
    }
    else {
        var parts = dataURL.split(BASE64_MARKER);
        var contentType = parts[0].split(':')[1];
        var raw = window.atob(parts[1]);
        var rawLength = raw.length;
        
        var uInt8Array = new Uint8Array(rawLength);
        
        for (var i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], {type: contentType});
    }
}

function sanitizeGalleryURL(url) {
	
	if (url.indexOf('http://localhost/') == 0) return url;
	
	var domain = 'synoptic.design'; 
	var aliasDomain = 'www.sqlbi.com/synopticdesign';
	if (url && url.indexOf('data:') == -1) {
		url = url.replace('http:', 'https:');
		
		//var currentDomain = url.split('/')[(url.indexOf("://") > -1 ? 2 : 0)];
		//currentDomain = currentDomain.split(':')[0];
		url = url.replace(aliasDomain, domain);
	}
	return url;
}

//Other helpers
function stripTags(str){
	if (str) return str.replace(/(<([^>]+)>)/ig,"");
	return '';
}

function stripSeconds(tim){
	tim = tim.toLowerCase();
	tim = tim.replace(':00 am', ':00am');
	tim = tim.replace(':00 pm', ':00pm');
	tim = tim.replace(':00:00', ':00');
	if (tim.indexOf(':') == 1) tim = '0'+tim;
	
	return tim;
}

// For IE8 and earlier version.
if (!Date.now) {
  Date.now = function() {
	return new Date().valueOf();
  }
}

//Newsletter function
function isValidEmailAddress(emailAddress) {
    var pattern = new RegExp(/^(("[\w-+\s]+")|([\w-+]+(?:\.[\w-+]+)*)|("[\w-+\s]+")([\w-+]+(?:\.[\w-+]+)*))(@((?:[\w-+]+\.)*\w[\w-+]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][\d]\.|1[\d]{2}\.|[\d]{1,2}\.))((25[0-5]|2[0-4][\d]|1[\d]{2}|[\d]{1,2})\.){2}(25[0-5]|2[0-4][\d]|1[\d]{2}|[\d]{1,2})\]?$)/i);
    return pattern.test(emailAddress);
}

function sqlbiSubscribe(){
	
	var email =  $('#df-subscribe').val();
	if (!isValidEmailAddress(email)){
		$('.newsletter form').show('fast');
		$('#df-subscribe').addClass('error').focus();
		return;	
	}

	$('.newsletter form').hide();
	$('#df-subscribe').removeClass('error');
	$('#df-feedback').html('Subscribing...<br>');
	
	$.post('https://www.sqlbi.com/wp-admin/admin-ajax.php', { "action": "newsletter_subscribe_ajax", "email" : email, "list" : [111, 41] }).always(function(data){ 
		
		if (data.indexOf("invalid") > -1) { 
			$('.newsletter form').show('fast');
			$('#df-subscribe').addClass('error').focus();
		
		} else {
		
			var msg = "Subscription successful! Please check your inbox, you will receive an email with an activation link.";
			$('#df-feedback').html(msg);
		}
	});

}