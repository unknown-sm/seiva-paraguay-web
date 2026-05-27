<?php
/**
 * Fix para payment-qr-woo: asegurar que el modal solo aparezca en checkout
 */

function kwp_yape_peru_is_checkout_page() {
    if ( ! function_exists( 'WC' ) || ! WC() ) return false;
    if ( is_checkout() ) return true;
    
    // Verificación adicional por page ID
    $checkout_page_id = wc_get_page_id( 'checkout' );
    if ( $checkout_page_id > 0 && is_page( $checkout_page_id ) ) return true;
    
    // Verificación por URL path
    $path = parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH );
    if ( $path && strpos( $path, '/checkout' ) !== false ) return true;
    
    return false;
}
