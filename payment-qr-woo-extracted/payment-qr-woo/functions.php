<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if (!function_exists('kwp_yape_peru_admin_script')) {
	function kwp_yape_peru_admin_script()
	{

		if (! did_action('wp_enqueue_media')) {
			wp_enqueue_media();
		}
		wp_enqueue_script('kwp-yape-peru-admin', plugins_url('/assets/woopro.js', __FILE__), array('jquery'), '1.1', false);
		wp_enqueue_style('kwp-yape-peru-admin', plugins_url('/assets/woopro.css', __FILE__), array(), '1.1');
	}
}
add_action('admin_enqueue_scripts', 'kwp_yape_peru_admin_script');

if (!function_exists('kwp_yape_peru_payment_popup')) {
	function kwp_yape_peru_payment_popup()
	{

		$options = get_option('woocommerce_wocommerce_yape_peru_settings');
?>
		<div class="popup-wrapper">
			<span class="helper"></span>
			<div class="popup-main-wrapper">
				<div class="popupCloseButton">&times;</div>
				<div class="first-step" data-price-limit="<?php echo (isset($options['limit_amount']) && !empty($options['limit_amount'])) ? esc_attr($options['limit_amount']) : ''; ?>">
					<?php
					if (isset($options['preview_qr']) && !empty($options['preview_qr'])) {
					?>
						<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage -- Imagen controlada ?>
						<img src="<?php echo esc_url($options['preview_qr']); ?>" class="popup-qr" alt="Preview Image" loading="lazy" />
						<?php if (isset($options['number_telephone']) && !empty($options['number_telephone'])) { ?>
							<span class="telephone-number"><a href="tel:<?php echo esc_attr($options['number_telephone']); ?>"><?php esc_html_e('Add Contact:', 'payment-qr-woo'); ?> <?php echo esc_attr($options['number_telephone']); ?></a></span>
						<?php } ?>
						<span class="price"><?php esc_html_e('Amount to Pay', 'payment-qr-woo'); ?><?php echo wp_kses_post(WC()->cart->get_cart_total()); ?></span>
						<?php if (isset($options['message_limit_amount']) && !empty($options['message_limit_amount'])) { ?>
							<p class="message-limit-amount"><?php echo esc_attr($options['message_limit_amount']); ?></p>
						<?php } ?>
						<?php if (isset($options['front_description']) && !empty($options['front_description'])) { ?>
							<p><?php echo esc_html($options['front_description']); ?></p>
						<?php } ?>
					<?php } ?>
					<div class="popup-price-wrapper"></div>
				</div>
				<div class="second-step">
					<form method="post" enctype="multipart/form-data" novalidate="" class="box has-advanced-upload">
						<div class="box__input">
							<input type="file" name="files" id="file" class="box__file" accept=".png, .jpg, .jpeg, .gif">
							<label for="file"><?php esc_html_e('Drag and Drop File to Upload', 'payment-qr-woo'); ?> <br /><br /> <?php esc_html_e('or', 'payment-qr-woo'); ?></label>
							<button type="submit" class="box__button"><?php esc_html_e('Select File', 'payment-qr-woo'); ?></button>
						</div>
						<input type="hidden" name="ajax" value="1">
					</form>
					<div class="error"><?php esc_html_e('Please Upload Your Receipt', 'payment-qr-woo'); ?></div>
					<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage -- Imagen estática del plugin, no requiere attachment ID ?>
					<img src="<?php echo esc_url(plugins_url('/assets/loader.gif', __FILE__)); ?>" class="loader" alt="<?php esc_attr_e( 'Loading...', 'payment-qr-woo' ); ?>"  width="25" height="25" loading="lazy" />

					<input type="submit" name="final_order" class="finalized_order btn_submit" value="<?php echo esc_attr('Complete Purchase', 'payment-qr-woo'); ?>">
				</div>
			</div>
		</div>
<?php
	}
}
add_action('wp_footer', 'kwp_yape_peru_payment_popup');

if (!function_exists('kwp_yape_peru_front_script')) {
	function kwp_yape_peru_front_script()
	{

		wp_enqueue_script('kodewp_payment_qr', plugins_url('assets/woopro-front.js', __FILE__), array('jquery'), '1.1', false);
		wp_enqueue_style('kodewp_payment_qr', plugins_url('assets/woopro-front.css', __FILE__), array(), '1.1');
		wp_localize_script(
			'kodewp_payment_qr',
			'kwajaxurl',
			array(
				'ajaxurl' 	=> admin_url('admin-ajax.php'),
				'nonce' 	=> wp_create_nonce('kwp_qr_nonce')
			)
		);

		wp_localize_script(
			'kodewp_payment_qr',
			'kwp_translate',
			array(
				'kwp_pqr_btn_continue' => __('Continue', 'payment-qr-woo'),
				'kwp_pqr_upload_images' => __('Please only upload images', 'payment-qr-woo'),
			)
		);
	}
}
add_action('wp_enqueue_scripts', 'kwp_yape_peru_front_script');


function kwp_yape_peru_qr_code_upload_dir($dirs)
{
	$custom_subdir = '/yape-peru-qrcode';

	$new_path = $dirs['basedir'] . $custom_subdir;
	$new_url  = $dirs['baseurl'] . $custom_subdir;

	// Crea la carpeta si no existe (usando WP_Filesystem)
	global $wp_filesystem;
	if (! $wp_filesystem) {
		require_once ABSPATH . '/wp-admin/includes/file.php';
		WP_Filesystem();
	}
	if (! $wp_filesystem->is_dir($new_path)) {
		$wp_filesystem->mkdir($new_path);
		$wp_filesystem->put_contents($new_path . '/index.html', '', FS_CHMOD_FILE);
	}

	return array_merge($dirs, array(
		'path'   => $new_path,
		'url'    => $new_url,
		'subdir' => $custom_subdir,
	));
}

if (!function_exists('kwp_yape_peru_qr_code_callback')) {
	function kwp_yape_peru_qr_code_callback()
	{

		$wp_nonce = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash($_POST['nonce'])) : '';
		if (!$wp_nonce || !wp_verify_nonce($wp_nonce, 'kwp_qr_nonce')) {
			wp_send_json_error('Invalid nonce.', 403);
		}

		if (!isset($_FILES['files'])) {
			wp_send_json_error('File not received.', 400);
		}

		if (
			!isset($_FILES['files']['name']) || !isset($_FILES['files']['type']) ||
			!isset($_FILES['files']['tmp_name']) || !isset($_FILES['files']['error']) ||
			!isset($_FILES['files']['size'])
		) {
			wp_send_json_error('File not received.', 400);
		}

		$file = [
			'name'     => sanitize_file_name($_FILES['files']['name']),
			'type'     => sanitize_mime_type($_FILES['files']['type']),
			'tmp_name' => sanitize_text_field($_FILES['files']['tmp_name']),
			'error'    => absint($_FILES['files']['error']),
			'size'     => absint($_FILES['files']['size']),
		];

		if (!is_uploaded_file($file['tmp_name'])) {
			wp_send_json_error('Invalid upload.', 400);
		}

		$check = wp_check_filetype_and_ext($file['tmp_name'], $file['name']);
		$ext = $check['ext'];

		if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif'])) {
			wp_send_json_error('error: Invalid file type. Only JPG, JPEG, and PNG allowed.', 400);
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		add_filter('upload_dir', 'kwp_yape_peru_qr_code_upload_dir');

		$overrides = array(
			'test_form' => false,
			'mimes'     => array(
				'jpg|jpeg' => 'image/jpeg',
				'png'      => 'image/png',
				'gif'      => 'image/gif',
			),
		);

		$file_name = pathinfo($file['name'], PATHINFO_FILENAME);
		$new_filename = sanitize_file_name($file_name . '-' . time() . "." . $ext);
		$file['name'] = $new_filename;

		$file_return = wp_handle_upload($file, $overrides);

		remove_filter('upload_dir', 'kwp_yape_peru_qr_code_upload_dir');

		if (isset($file_return['url'])) {
			session_start();
			$_SESSION['yape-peru-qrcode'] = esc_url_raw($file_return['url']);
			wp_send_json_success('File uploaded.');
		} else {
			wp_send_json_error('Upload failed.', 500);
		}

		wp_die();
	}
}
add_action('wp_ajax_kwp_yape_peru_qr_code', 'kwp_yape_peru_qr_code_callback');
add_action('wp_ajax_nopriv_kwp_yape_peru_qr_code', 'kwp_yape_peru_qr_code_callback');

/* Add meta box for edit order */
if (!function_exists('kwp_yape_peru_meta_box')) {
	function kwp_yape_peru_meta_box()
	{
		if (version_compare(WC_VERSION, '7.0.0', '>=')) {
			add_meta_box('kwp-yape-peru-meta-box', __('QR Code Payment Receipt', 'payment-qr-woo'), 'kwp_yape_peru_meta_box_callback', 'woocommerce_page_wc-orders', 'normal');
		} else {
			add_meta_box('kwp-yape-peru-meta-box', __('QR Code Payment Receipt', 'payment-qr-woo'), 'kwp_yape_peru_meta_box_callback', 'shop_order', 'normal');
		}
	}
}
add_action('add_meta_boxes', 'kwp_yape_peru_meta_box');

/* Meta box callback */
if (!function_exists('kwp_yape_peru_meta_box_callback')) {
	function kwp_yape_peru_meta_box_callback($post)
	{
		$yape_peru_qrcode = get_post_meta($post->ID, 'yape-peru-qrcode', true);

		if (! empty($yape_peru_qrcode) && esc_url($yape_peru_qrcode)) {
			echo '<a href="' . esc_url($yape_peru_qrcode) . '" target="_blank" loading="lazy">';
			// phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage -- Imagen controlada
			echo '<img src="' . esc_url($yape_peru_qrcode) . '" alt="Payment Image" width="200" height="200" loading="lazy" />';
			echo '</a>';
		}
	}
}
