jQuery(function ($) {
    'use strict';

    ; (function (document, window, index) {
        // feature detection for drag&drop upload
        var isAdvancedUpload = function () {
            var div = document.createElement('div');
            return (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)) && 'FormData' in window && 'FileReader' in window;
        }();

        function isValidImage(file) {
            return file.type.match('image.*');
        }

        // applying the effect for every form
        var forms = document.querySelectorAll('.box');
        Array.prototype.forEach.call(forms, function (form) {
            var input = form.querySelector('input[type="file"]'),
                label = form.querySelector('label'),
                errorMsg = form.querySelector('.box__error span'),
                restart = form.querySelectorAll('.box__restart'),
                droppedFiles = false,
                showFiles = function (files) {
                    label.textContent = files.length > 1 ? (input.getAttribute('data-multiple-caption') || '').replace('{count}', files.length) : files[0].name;
                },
                triggerFormSubmit = function () {
                    var event = document.createEvent('HTMLEvents');
                    event.initEvent('submit', true, false);
                    form.dispatchEvent(event);
                };

            // letting the server side to know we are going to make an Ajax request
            var ajaxFlag = document.createElement('input');
            ajaxFlag.setAttribute('type', 'hidden');
            ajaxFlag.setAttribute('name', 'ajax');
            ajaxFlag.setAttribute('value', 1);
            form.appendChild(ajaxFlag);

            // automatically submit the form on file select
            input.addEventListener('change', function (e) {
                let selectedFiles = Array.from(e.target.files);

                // Ensure only 1 is uploaded
                if (selectedFiles.length != 1) {
                    alert("Debes seleccionar solo un archivo.");
                    input.value = ''; // Reset input
                    label.textContent = "No file selected";
                    return;
                }

                // Check if all selected files are images
                if (!selectedFiles.every(isValidImage)) {
                    alert("Only image files (JPG, PNG, GIF, etc.) are allowed.");
                    input.value = ''; // Reset input
                    label.textContent = "No file selected";
                    return;
                }

                droppedFiles = selectedFiles;
                showFiles(e.target.files);
            });

            // drag&drop files if the feature is available
            if (isAdvancedUpload) {
                form.classList.add('has-advanced-upload'); // letting the CSS part to know drag&drop is supported by the browser

                ['drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'].forEach(function (event) {
                    form.addEventListener(event, function (e) {
                        // preventing the unwanted behaviours
                        e.preventDefault();
                        e.stopPropagation();
                    });
                });
                ['dragover', 'dragenter'].forEach(function (event) {
                    form.addEventListener(event, function () {
                        form.classList.add('is-dragover');
                    });
                });
                ['dragleave', 'dragend', 'drop'].forEach(function (event) {
                    form.addEventListener(event, function () {
                        form.classList.remove('is-dragover');
                    });
                });
                form.addEventListener('drop', function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    let dropped = Array.from(e.dataTransfer.files);

                    // Ensure only 1 is uploaded
                    if (dropped.length != 1) {
                        alert("Debes seleccionar solo un archivo.");
                        return;
                    }

                    if (!dropped.every(isValidImage)) {
                        alert("Only image files (JPG, PNG, GIF, etc.) are allowed.");
                        return;
                    }

                    droppedFiles = dropped;
                    showFiles(droppedFiles);
                });
            }

            $('body').on('click', '.finalized_order', function (e) {
                e.preventDefault();
                $('.popup-wrapper .loader').css('display', 'block');

                if (!droppedFiles || droppedFiles.length != 1) {
                    alert("Debes seleccionar un archivo.");
                    $('.popup-wrapper .loader').css('display', 'none');
                    return;
                }

                var ajaxData = new FormData(form);
                
                ajaxData.append('action', 'kwp_yape_peru_qr_code');
                ajaxData.append('files', droppedFiles[0]);
                ajaxData.append('nonce', kwajaxurl.nonce);

                $.ajax({
                    url: kwajaxurl.ajaxurl,
                    type: 'POST',
                    processData: false,
                    contentType: false,
                    data: ajaxData,
                    success: function (response) {
                        $('.popup-wrapper .loader').css('display', 'none');

                        if (response.success && response.data) {
                            $('form.checkout').addClass('place-order-qr');
                            $('.popup-wrapper').hide();
                            $('#place_order').trigger('click');
                        } else {
                            $("form.box")[0].reset();
                            $('.popup-wrapper .error').show().html(kwp_translate.kwp_pqr_upload_images).delay(2000).slideUp();
                        }

                    },
                    error: function (xhr) {
                        $('.popup-wrapper .loader').hide();
                        $('.popup-wrapper .error').show().html('Error de red.').delay(2000).slideUp();
                    }
                });
            });

            // if the form was submitted
            form.addEventListener('submit', function (e) {
                // preventing the duplicate submissions if the current one is in progress
                if (form.classList.contains('is-uploading')) return false;

                form.classList.add('is-uploading');
                form.classList.remove('is-error');

                if (isAdvancedUpload) {
                    e.preventDefault();

                    // gathering the form data
                    var ajaxData = new FormData(form);
                    if (droppedFiles) {
                        Array.prototype.forEach.call(droppedFiles, function (file) {
                            ajaxData.append(input.getAttribute('name'), file);
                        });
                    }

                    // ajax request
                    var ajax = new XMLHttpRequest();
                    ajax.open(form.getAttribute('method'), form.getAttribute('action'), true);

                    ajax.onload = function () {
                        form.classList.remove('is-uploading');
                        if (ajax.status >= 200 && ajax.status < 400) {
                            var data = JSON.parse(ajax.responseText);
                            form.classList.add(data.success == true ? 'is-success' : 'is-error');
                            if (!data.success) errorMsg.textContent = data.error;
                        }
                        else alert('Error. Please, contact the webmaster!');
                    };

                    ajax.onerror = function () {
                        form.classList.remove('is-uploading');
                        alert('Error. Please, try again!');
                    };

                    ajax.send(ajaxData);
                }
                else // fallback Ajax solution upload for older browsers
                {
                    var iframeName = 'uploadiframe' + new Date().getTime(),
                        iframe = document.createElement('iframe');

                    $iframe = $('<iframe name="' + iframeName + '" style="display: none;"></iframe>');

                    iframe.setAttribute('name', iframeName);
                    iframe.style.display = 'none';

                    document.body.appendChild(iframe);
                    form.setAttribute('target', iframeName);

                    iframe.addEventListener('load', function () {
                        var data = JSON.parse(iframe.contentDocument.body.innerHTML);
                        form.classList.remove('is-uploading')
                        form.classList.add(data.success == true ? 'is-success' : 'is-error')
                        form.removeAttribute('target');
                        if (!data.success) errorMsg.textContent = data.error;
                        iframe.parentNode.removeChild(iframe);
                    });
                }
            });

            // restart the form if has a state of error/success
            Array.prototype.forEach.call(restart, function (entry) {
                entry.addEventListener('click', function (e) {
                    e.preventDefault();
                    form.classList.remove('is-error', 'is-success');
                    input.click();
                });
            });

            // Firefox focus bug fix for file input
            input.addEventListener('focus', function () { input.classList.add('has-focus'); });
            input.addEventListener('blur', function () { input.classList.remove('has-focus'); });

        });
    }(document, window, 0));


    function show_qr_modal(e) {
        const paymentMethod = jQuery('input[name="payment_method"]:checked').val();

        if (paymentMethod == "wocommerce_yape_peru") {

            if (!$('form.checkout').hasClass("place-order-qr")) {
                e.preventDefault();

                $('.popup-wrapper').show();
                $('.first-step .woocommerce-Price-amount').remove();

                var priceLimit = $('.first-step').data('price-limit');
                if (priceLimit) {
                    $('.first-step .popup-price-wrapper').append($('.order-total .woocommerce-Price-amount').first().clone());
                    $('.first-step .popup-price-wrapper .woocommerce-Price-currencySymbol').remove();
                    var getPrice = $('.first-step .popup-price-wrapper').text();
                    if (getPrice) {
                        if (parseFloat(priceLimit) < parseFloat(getPrice) && parseFloat(priceLimit) != parseFloat(getPrice)) {
                            $('.first-step .message-limit-amount').show();
                            $('.first-step .btn-continue').remove();
                        } else {
                            $('.first-step .message-limit-amount').hide();
                            $('.first-step .btn-continue').remove();
                            $('.first-step').append('<button class="btn-continue btn_submit">' + kwp_translate.kwp_pqr_btn_continue + '</button>');
                        }
                    }
                } else {
                    $('.first-step .btn-continue').remove();
                    $('.first-step').append('<button class="btn-continue btn_submit">' + kwp_translate.kwp_pqr_btn_continue + '</button>');
                }
                $('.first-step .price').append($('.order-total .woocommerce-Price-amount').first().clone());

                return false;
            }
        }
    }

    $('form.checkout').on('submit', show_qr_modal);
    $('form.checkout').on('click', '#place_order', show_qr_modal)

    $('.popupCloseButton').click(function () {
        $('.second-step').css('display', 'none');
        $('.popup-wrapper .error').css('display', 'none');
        $('.first-step').css('display', 'block');
        $('.popup-wrapper').hide();
    });

    $('.first-step').on('click', '.btn-continue', function () {
        $('.second-step').show();
        $('.first-step').hide();
    });

    $('.box__button').click(function (e) {
        e.preventDefault();
        $('.box__file').trigger('click');
    });

});