jQuery( function( $ ) {
 
    $( document ).on( 'click', '.kwp_upload_icon_button', function( e ) {
        e.preventDefault();
  
        var button = $( this ),
        aw_uploader = wp.media({
            title: 'Custom icon',
            library : {
                uploadedTo : wp.media.view.settings.post.id, 
                type : 'image'
            },
            button: {
                text: 'Use this icon'
            },
            multiple: false
        }).on( 'select', function() {
            var attachment = aw_uploader.state().get( 'selection' ).first().toJSON();
            $( '.preview_icon_area' ).html('<img src="'+attachment.url+'" class="upload_icon" style="display: block; padding: 10px; width: 200px;border: 1px solid;margin-bottom: 10px;"><button class="remove_icon button-secondary" type="button">Remove</button>');
            $( '.kwp_preview_icon' ).val( attachment.url );
        })
        .open();
    });

    $( document ).on( 'click', '.kwp_upload_image_button', function( e ) {
        e.preventDefault();
  
        var button = $( this ),
        aw_uploader = wp.media({
            title: 'Custom image',
            library : {
                uploadedTo : wp.media.view.settings.post.id, 
                type : 'image'
            },
            button: {
                text: 'Use this image'
            },
            multiple: false
        }).on( 'select', function() {
            var attachment = aw_uploader.state().get( 'selection' ).first().toJSON();
            $( '.preview_area' ).html('<img src="'+attachment.url+'" class="upload_qr" style="display: block; padding: 10px; width: 200px;border: 1px solid;margin-bottom: 10px;"><button class="remove_qr button-secondary" type="button">Remove</button>');
            $( '.kwp_preview_qr' ).val( attachment.url );
        })
        .open();
    });

    $( document ).on( 'click', '.remove_icon', function( e ) {
        e.preventDefault();
        $( '.upload_icon' ).remove();
        $( '.kwp_preview_icon' ).val('');
        $( this ).remove();
    });

    $( document ).on( 'click', '.remove_qr', function( e ) {
        e.preventDefault();
        $( '.upload_qr' ).remove();
        $( '.kwp_preview_qr' ).val('');
        $( this ).remove();
    });
});