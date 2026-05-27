<?php

if (! defined('ABSPATH')) {
	exit;
}

/*
 * Plugin Name: Payment QR for woocommerce
 * Description: Add-on for WooCommerce, a payment method to make payments using QR code.
 * Requires at least: 5.2
 * Tested up to: 6.9
 * Requires PHP: 7.4
 * Version: 1.1.7
 * Author: Miguel Fuentes
 * Plugin URI: https://wordpress.org/plugins/payment-qr-woo/
 * Author URI: https://kodewp.com/
 * Text Domain: payment-qr-woo
 * Requires Plugins: woocommerce
 * WC tested up to: 10.4.3
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
*/

/*
 * This action hook registers our PHP class as a WooCommerce payment gateway
 */
add_filter('woocommerce_payment_gateways', 'kwp_yape_peru_add_gateway_class');
function kwp_yape_peru_add_gateway_class($gateways)
{
	$gateways[] = 'Kwp_Yape_Peru_WC_Gateway';
	return $gateways;
}

/*
 * The class itself, please note that it is inside plugins_loaded action hook
 */
add_action('plugins_loaded', 'kwp_yape_peru_init_gateway_class');
function kwp_yape_peru_init_gateway_class()
{

	if (class_exists('WC_Payment_Gateway')) {

		require plugin_dir_path(__FILE__) . 'functions.php';

		class Kwp_Yape_Peru_WC_Gateway extends WC_Payment_Gateway
		{

			public function __construct()
			{

				$this->id = 'wocommerce_yape_peru'; // payment gateway plugin ID
				$this->icon = ''; // URL of the icon that will be displayed on checkout page near your gateway name
				$this->has_fields = true; // in case you need a custom credit card form
				$this->method_title = __('Payment QR for woocommerce', 'payment-qr-woo');
				$this->method_description = __('QR Payment Method.', 'payment-qr-woo'); // will be displayed on the options page

				// gateways can support subscriptions, refunds, saved payment methods,
				// but in this tutorial we begin with simple payments
				$this->supports = array(
					'products'
				);

				// Method with all the options fields
				$this->init_form_fields();

				// Load the settings.
				$this->init_settings();
				$this->title = $this->get_option('title');
				$this->description = $this->get_option('description');
				$this->enabled = $this->get_option('enabled');

				// This action hook saves the settings
				add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
			}

			/**
			 * Plugin options, we deal with it in Step 3 too
			 */
			public function init_form_fields()
			{

				$this->form_fields = array(
					'enabled' => array(
						'title'       => __('Enable/Disable', 'payment-qr-woo'),
						'label'       => __('Enable Payment QR for woocommerce', 'payment-qr-woo'),
						'type'        => 'checkbox',
						'description' => '',
						'default'     => 'no'
					),
					'title' => array(
						'title'       => __('Title', 'payment-qr-woo'),
						'type'        => 'text',
						'description' => __('This controls the title the user sees during checkout.', 'payment-qr-woo'),
						'default'     => __('Payment QR for woocommerce', 'payment-qr-woo'),
						'desc_tip'    => true,
					),
					'upload_icon' => array(
						'title'       => __('Select Image Icon', 'payment-qr-woo'),
						'type'        => 'kwp_yape_peru_icon',
						'class'		  => 'kwp_upload_icon_button button-secondary',
						'label'		  => 'axa',
						'description' => __('Here you must upload the image icon.', 'payment-qr-woo'),
						'desc_tip'    => true,
					),
					'preview_icon' => array(
						'title'       => '',
						'type'        => 'hidden',
						'class'		  => 'kwp_preview_icon',
					),
					'description' => array(
						'title'       => __('Description', 'payment-qr-woo'),
						'type'        => 'textarea',
						'description' => __('This controls the description the user sees during checkout.', 'payment-qr-woo'),
						'default'     => __('Payment method via QR, when payment is made, proof must be attached with the order order.', 'payment-qr-woo'),
						'desc_tip'    => true,
					),
					'front_description' => array(
						'title'       => __('Popup description', 'payment-qr-woo'),
						'type'        => 'textarea',
						'default'     => __('You must scan the QR code, click continue to attach the screenshot (it is the only proof of payment) and you will be able to complete the purchase.', 'payment-qr-woo'),
						'desc_tip'    => true,
					),
					'limit_amount' => array(
						'title'       => __('Limit Amount', 'payment-qr-woo'),
						'type'        => 'text',
						'description' => __('In this field you can enter the payment limit amount', 'payment-qr-woo'),
						'default'     => '',
						'desc_tip'    => true,
					),
					'message_limit_amount' => array(
						'title'       => __('Limit Amount Message', 'payment-qr-woo'),
						'type'        => 'text',
						'description' => __('Add the message to inform about the limit of the amount to pay.', 'payment-qr-woo'),
						'default'     => __('This method does not allow payments greater than 500 per day.', 'payment-qr-woo'),
						'desc_tip'    => true,
					),
					'number_telephone' => array(
						'title'       => __('Affiliate Phone Number', 'payment-qr-woo'),
						'type'        => 'text',
						'description' => __('This number must be the one affiliated with the application you are configuring..', 'payment-qr-woo'),
						'default'     => '',
						'desc_tip'    => true,
					),
					'upload_qr' => array(
						'title'       => __('Select QR Image', 'payment-qr-woo'),
						'type'        => 'button',
						'class'		  => 'kwp_upload_image_button button-secondary',
						'label'		  => 'axa',
						'description' => __('Here you must upload the QR image.', 'payment-qr-woo'),
						'desc_tip'    => true,
					),
					'preview_qr' => array(
						'title'       => '',
						'type'        => 'hidden',
						'class'		  => 'kwp_preview_qr',
					)
				);
			}

			public function generate_kwp_yape_peru_icon_html($key, $data)
			{
				$field    = $this->plugin_id . $this->id . '_' . $key;
				$defaults = array(
					'class'             => 'button-secondary',
					'css'               => '',
					'custom_attributes' => array(),
					'desc_tip'          => false,
					'description'       => '',
					'title'             => '',
				);

				$data = wp_parse_args($data, $defaults);

				ob_start();
?>
				<tr valign="top">
					<th scope="row" class="titledesc">
						<label for="<?php echo esc_attr($field); ?>"><?php echo wp_kses_post($data['title']); ?></label>
						<?php echo wp_kses_post($this->get_tooltip_html($data)); ?>
					</th>
					<td class="forminp">
						<fieldset>
							<legend class="screen-reader-text"><span><?php echo wp_kses_post($data['title']); ?></span></legend>
							<div class="upload_area woocommerce-yape-peru-upload-wrapper">
								<span><?php esc_html_e('Upload application logo', 'payment-qr-woo'); ?></span>
								<button class="<?php echo esc_attr($data['class']); ?>" type="button" name="<?php echo esc_attr($field); ?>" id="<?php echo esc_attr($field); ?>" style="<?php echo esc_attr($data['css']); ?>" <?php echo wp_kses_post($this->get_custom_attribute_html($data)); ?>><?php echo wp_kses_post($data['title']); ?></button>
							</div>
						</fieldset>
					</td>
				</tr>
				<tr valign="top">
					<th scope="row" class="titledesc">
						<label for="<?php echo esc_attr($field); ?>"><?php esc_html_e('Preview', 'payment-qr-woo'); ?></label>
					</th>
					<td class="forminp yape-preview-area">
						<fieldset>
							<legend class="screen-reader-text"><span><?php esc_html_e('Preview', 'payment-qr-woo'); ?></span></legend>
							<div class="preview_icon_area">
								<?php
								$options = get_option('woocommerce_wocommerce_yape_peru_settings');
								if (isset($options['preview_icon']) && !empty($options['preview_icon'])) {
								?>
									<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage -- Imagen controlada 
									?>
									<img src="<?php echo esc_url($options['preview_icon']); ?>" class="upload_icon" alt="Preview Icon" loading="lazy">
									<button class="remove_icon button-secondary" type="button"><?php esc_html_e('Remove', 'payment-qr-woo'); ?></button>
									<?php echo esc_html($this->get_description_html($data)); ?>
								<?php } ?>
							</div>
						</fieldset>
					</td>
				</tr>
			<?php
				return ob_get_clean();
			}

			public function generate_button_html($key, $data)
			{
				$field    = $this->plugin_id . $this->id . '_' . $key;
				$defaults = array(
					'class'             => 'button-secondary',
					'css'               => '',
					'custom_attributes' => array(),
					'desc_tip'          => false,
					'description'       => '',
					'title'             => '',
				);

				$data = wp_parse_args($data, $defaults);

				ob_start();
			?>
				<tr valign="top">
					<th scope="row" class="titledesc">
						<label for="<?php echo esc_attr($field); ?>"><?php echo wp_kses_post($data['title']); ?></label>
						<?php echo wp_kses_post($this->get_tooltip_html($data)); ?>
					</th>
					<td class="forminp">
						<fieldset>
							<legend class="screen-reader-text"><span><?php echo wp_kses_post($data['title']); ?></span></legend>
							<div class="upload_area woocommerce-yape-peru-upload-wrapper">
								<span><?php esc_html_e('Upload the QR here', 'payment-qr-woo'); ?></span>
								<button class="<?php echo esc_attr($data['class']); ?>" type="button" name="<?php echo esc_attr($field); ?>" id="<?php echo esc_attr($field); ?>" style="<?php echo esc_attr($data['css']); ?>" <?php echo wp_kses_post($this->get_custom_attribute_html($data)); ?>><?php echo wp_kses_post($data['title']); ?></button>
							</div>
						</fieldset>
					</td>
				</tr>
				<tr valign="top">
					<th scope="row" class="titledesc">
						<label for="<?php echo esc_attr($field); ?>"><?php esc_html_e('Preview', 'payment-qr-woo'); ?></label>
					</th>
					<td class="forminp yape-preview-area">
						<fieldset>
							<legend class="screen-reader-text"><span><?php esc_html_e('Preview', 'payment-qr-woo'); ?></span></legend>
							<div class="preview_area">
								<?php
								$options = get_option('woocommerce_wocommerce_yape_peru_settings');
								if (isset($options['preview_qr']) && !empty($options['preview_qr'])) {
								?>
									<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage -- Imagen controlada 
									?>
									<img src="<?php echo esc_attr($options['preview_qr']); ?>" class="upload_qr" alt="Preview Icon" loading="lazy">
									<button class="remove_qr button-secondary" type="button"><?php esc_html_e('Remove', 'payment-qr-woo'); ?></button>
									<?php echo esc_html($this->get_description_html($data)); ?>
								<?php } ?>
							</div>
						</fieldset>
					</td>
				</tr>
				<?php
				return ob_get_clean();
			}

			/**
			 * You will need it if you want your custom credit card form, Step 4 is about it
			 */
			public function payment_fields()
			{

				// ok, let's display some description before the payment form
				if ($this->description) {
					// display the description with <p> tags etc.
					echo wp_kses_post(wpautop($this->description));
				}
				$options = get_option('woocommerce_wocommerce_yape_peru_settings');
				if (isset($options['preview_icon']) && !empty($options['preview_icon'])) {
				?>
					<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage -- Imagen controlada 
					?>
					<img src="<?php echo esc_url($options['preview_icon']); ?>" alt="Preview Icon" loading="lazy" />
				<?php } else { ?>
					<?php // phpcs:ignore PluginCheck.CodeAnalysis.ImageFunctions.NonEnqueuedImage -- Imagen controlada 
					?>
					<img src="<?php echo esc_url(plugin_dir_url(__FILE__) . 'assets/yape.png'); ?>" alt="Preview Icon" loading="lazy" />
<?php
				}
			}

			/*
			 * We're processing the payments here, everything about it is in Step 5
			 */
			public function process_payment($order_id)
			{

				session_start();
				$order = wc_get_order($order_id);

				if (isset($_SESSION['yape-peru-qrcode'])) {
					update_post_meta($order_id, 'yape-peru-qrcode', esc_url_raw($_SESSION['yape-peru-qrcode']));
					unset($_SESSION['yape-peru-qrcode']);
				}


				// Mark as on-hold (we're awaiting the payment)
				$order->update_status('on-hold', __('Awaiting offline payment', 'payment-qr-woo'));

				// Reduce stock levels
				$order->reduce_order_stock();

				// Remove cart
				WC()->cart->empty_cart();

				// Return thankyou redirect
				return array(
					'result'    => 'success',
					'redirect'  => $this->get_return_url($order)
				);
			}
		}
	}
}
