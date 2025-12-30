const axios = require('axios');
const logger = require('./logger');

/**
 * Shiprocket API Integration Service
 * 
 * Documentation: https://apidocs.shiprocket.in/
 * 
 * Features:
 * - Token-based authentication with auto-refresh
 * - Order creation and management
 * - AWB generation and courier assignment
 * - Real-time tracking
 * - Webhook support for status updates
 * - Return/cancellation management
 */

const SHIPROCKET_API_BASE_URL = process.env.SHIPROCKET_API_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';

class ShiprocketService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
    this.email = process.env.SHIPROCKET_EMAIL;
    this.password = process.env.SHIPROCKET_PASSWORD;
  }

  /**
   * Authenticate with Shiprocket and get access token
   */
  async authenticate() {
    try {
      const response = await axios.post(`${SHIPROCKET_API_BASE_URL}/auth/login`, {
        email: this.email,
        password: this.password
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        // Token typically expires in 10 days, we'll refresh after 9 days
        this.tokenExpiry = Date.now() + (9 * 24 * 60 * 60 * 1000);
        
        logger.info('Shiprocket authentication successful');
        return this.token;
      } else {
        throw new Error('Invalid authentication response from Shiprocket');
      }
    } catch (error) {
      logger.error('Shiprocket authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Shiprocket');
    }
  }

  /**
   * Get valid token, refresh if expired
   */
  async getToken() {
    if (!this.token || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
    return this.token;
  }

  /**
   * Make authenticated API request
   */
  async request(method, endpoint, data = null) {
    try {
      const token = await this.getToken();
      const config = {
        method,
        url: `${SHIPROCKET_API_BASE_URL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      logger.error(`Shiprocket API error [${method} ${endpoint}]:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create order in Shiprocket
   * 
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} Shiprocket order response
   */
  async createOrder(orderData) {
    const {
      orderId,
      orderDate,
      pickupLocation = 'Primary',
      billingCustomerName,
      billingLastName = '',
      billingAddress,
      billingAddress2 = '',
      billingCity,
      billingPincode,
      billingState,
      billingCountry = 'India',
      billingEmail,
      billingPhone,
      shippingIsBilling = true,
      shippingCustomerName,
      shippingLastName = '',
      shippingAddress,
      shippingAddress2 = '',
      shippingCity,
      shippingPincode,
      shippingState,
      shippingCountry = 'India',
      shippingEmail,
      shippingPhone,
      orderItems,
      paymentMethod = 'Prepaid',
      shippingCharges = 0,
      giftWrap = 0,
      transactionCharges = 0,
      totalDiscount = 0,
      subTotal,
      length,
      breadth,
      height,
      weight
    } = orderData;

    const payload = {
      order_id: orderId,
      order_date: orderDate || new Date().toISOString().split('T')[0],
      pickup_location: pickupLocation,
      billing_customer_name: billingCustomerName,
      billing_last_name: billingLastName,
      billing_address: billingAddress,
      billing_address_2: billingAddress2,
      billing_city: billingCity,
      billing_pincode: billingPincode,
      billing_state: billingState,
      billing_country: billingCountry,
      billing_email: billingEmail,
      billing_phone: billingPhone,
      shipping_is_billing: shippingIsBilling,
      shipping_customer_name: shippingCustomerName || billingCustomerName,
      shipping_last_name: shippingLastName || billingLastName,
      shipping_address: shippingAddress || billingAddress,
      shipping_address_2: shippingAddress2 || billingAddress2,
      shipping_city: shippingCity || billingCity,
      shipping_pincode: shippingPincode || billingPincode,
      shipping_state: shippingState || billingState,
      shipping_country: shippingCountry || billingCountry,
      shipping_email: shippingEmail || billingEmail,
      shipping_phone: shippingPhone || billingPhone,
      order_items: orderItems,
      payment_method: paymentMethod,
      shipping_charges: shippingCharges,
      giftwrap_charges: giftWrap,
      transaction_charges: transactionCharges,
      total_discount: totalDiscount,
      sub_total: subTotal,
      length: length || 10,
      breadth: breadth || 10,
      height: height || 5,
      weight: weight || 0.5
    };

    try {
      const response = await this.request('POST', '/orders/create/adhoc', payload);
      logger.info('Shiprocket order created:', {
        orderId,
        shipmentId: response.shipment_id,
        orderId: response.order_id
      });
      return response;
    } catch (error) {
      logger.error('Failed to create Shiprocket order:', {
        orderId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Generate AWB (Airway Bill) for shipment
   * 
   * @param {number} shipmentId - Shiprocket shipment ID
   * @param {number} courierId - Courier company ID
   * @returns {Promise<Object>} AWB details
   */
  async generateAWB(shipmentId, courierId) {
    try {
      const response = await this.request('POST', '/courier/assign/awb', {
        shipment_id: shipmentId,
        courier_id: courierId
      });
      
      logger.info('AWB generated:', {
        shipmentId,
        awbCode: response.awb_code,
        courierId
      });
      
      return response;
    } catch (error) {
      logger.error('Failed to generate AWB:', {
        shipmentId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Get recommended courier services for a shipment
   * 
   * @param {number} shipmentId - Shiprocket shipment ID
   * @returns {Promise<Array>} List of available couriers with rates
   */
  async getRecommendedCouriers(shipmentId) {
    try {
      const response = await this.request('GET', `/courier/serviceability/?shipment_id=${shipmentId}`);
      
      logger.info('Fetched recommended couriers:', {
        shipmentId,
        courierCount: response.data?.available_courier_companies?.length || 0
      });
      
      return response.data?.available_courier_companies || [];
    } catch (error) {
      logger.error('Failed to get recommended couriers:', {
        shipmentId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Assign courier to shipment
   * 
   * @param {number} shipmentId - Shiprocket shipment ID
   * @param {number} courierId - Courier company ID
   * @returns {Promise<Object>} Assignment response
   */
  async assignCourier(shipmentId, courierId) {
    try {
      const response = await this.request('POST', '/courier/assign/awb', {
        shipment_id: shipmentId,
        courier_id: courierId
      });
      
      logger.info('Courier assigned:', {
        shipmentId,
        courierId,
        awbCode: response.awb_code
      });
      
      return response;
    } catch (error) {
      logger.error('Failed to assign courier:', {
        shipmentId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Request pickup for shipment
   * 
   * @param {number} shipmentId - Shiprocket shipment ID
   * @returns {Promise<Object>} Pickup request response
   */
  async requestPickup(shipmentId) {
    try {
      const response = await this.request('POST', '/courier/generate/pickup', {
        shipment_id: [shipmentId]
      });
      
      logger.info('Pickup requested:', {
        shipmentId,
        pickupStatus: response.pickup_status
      });
      
      return response;
    } catch (error) {
      logger.error('Failed to request pickup:', {
        shipmentId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Track shipment by AWB or shipment ID
   * 
   * @param {string|number} identifier - AWB code or shipment ID
   * @param {string} type - 'awb' or 'shipment_id'
   * @returns {Promise<Object>} Tracking details
   */
  async trackShipment(identifier, type = 'shipment_id') {
    try {
      let endpoint;
      if (type === 'awb') {
        endpoint = `/courier/track/awb/${identifier}`;
      } else {
        endpoint = `/courier/track/shipment/${identifier}`;
      }
      
      const response = await this.request('GET', endpoint);
      
      logger.info('Shipment tracked:', {
        identifier,
        type,
        status: response.tracking_data?.shipment_status
      });
      
      return response;
    } catch (error) {
      logger.error('Failed to track shipment:', {
        identifier,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Cancel shipment
   * 
   * @param {Array<number>} awbCodes - List of AWB codes to cancel
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelShipment(awbCodes) {
    try {
      const response = await this.request('POST', '/orders/cancel', {
        awbs: awbCodes
      });
      
      logger.info('Shipment(s) cancelled:', {
        awbCodes,
        message: response.message
      });
      
      return response;
    } catch (error) {
      logger.error('Failed to cancel shipment:', {
        awbCodes,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Create return order
   * 
   * @param {Object} returnData - Return order details
   * @returns {Promise<Object>} Return order response
   */
  async createReturn(returnData) {
    const {
      orderId,
      orderDate,
      channelId,
      pickupCustomerName,
      pickupLastName = '',
      pickupAddress,
      pickupAddress2 = '',
      pickupCity,
      pickupState,
      pickupCountry = 'India',
      pickupPincode,
      pickupEmail,
      pickupPhone,
      shippingCustomerName,
      shippingLastName = '',
      shippingAddress,
      shippingAddress2 = '',
      shippingCity,
      shippingState,
      shippingCountry = 'India',
      shippingPincode,
      shippingEmail,
      shippingPhone,
      orderItems,
      paymentMethod = 'Prepaid',
      totalDiscount = 0,
      subTotal,
      length,
      breadth,
      height,
      weight
    } = returnData;

    const payload = {
      order_id: orderId,
      order_date: orderDate,
      channel_id: channelId || '',
      pickup_customer_name: pickupCustomerName,
      pickup_last_name: pickupLastName,
      pickup_address: pickupAddress,
      pickup_address_2: pickupAddress2,
      pickup_city: pickupCity,
      pickup_state: pickupState,
      pickup_country: pickupCountry,
      pickup_pincode: pickupPincode,
      pickup_email: pickupEmail,
      pickup_phone: pickupPhone,
      shipping_customer_name: shippingCustomerName,
      shipping_last_name: shippingLastName,
      shipping_address: shippingAddress,
      shipping_address_2: shippingAddress2,
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_country: shippingCountry,
      shipping_pincode: shippingPincode,
      shipping_email: shippingEmail,
      shipping_phone: shippingPhone,
      order_items: orderItems,
      payment_method: paymentMethod,
      total_discount: totalDiscount,
      sub_total: subTotal,
      length: length || 10,
      breadth: breadth || 10,
      height: height || 5,
      weight: weight || 0.5
    };

    try {
      const response = await this.request('POST', '/orders/create/return', payload);
      logger.info('Return order created:', {
        orderId,
        shipmentId: response.shipment_id
      });
      return response;
    } catch (error) {
      logger.error('Failed to create return order:', {
        orderId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Get pickup locations
   * 
   * @returns {Promise<Array>} List of pickup locations
   */
  async getPickupLocations() {
    try {
      const response = await this.request('GET', '/settings/company/pickup');
      return response.data?.shipping_address || [];
    } catch (error) {
      logger.error('Failed to get pickup locations:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate shipping label
   * 
   * @param {Array<number>} shipmentIds - List of shipment IDs
   * @returns {Promise<Object>} Label URL response
   */
  async generateLabel(shipmentIds) {
    try {
      const response = await this.request('POST', '/courier/generate/label', {
        shipment_id: shipmentIds
      });
      
      logger.info('Label generated:', {
        shipmentIds,
        labelUrl: response.label_url
      });
      
      return response;
    } catch (error) {
      logger.error('Failed to generate label:', {
        shipmentIds,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Generate manifest
   * 
   * @param {Array<number>} shipmentIds - List of shipment IDs
   * @returns {Promise<Object>} Manifest response
   */
  async generateManifest(shipmentIds) {
    try {
      const response = await this.request('POST', '/manifests/generate', {
        shipment_id: shipmentIds
      });
      
      logger.info('Manifest generated:', {
        shipmentIds,
        manifestUrl: response.manifest_url
      });
      
      return response;
    } catch (error) {
      logger.error('Failed to generate manifest:', {
        shipmentIds,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Get all orders with filters
   * 
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Orders list
   */
  async getOrders(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams ? `/orders?${queryParams}` : '/orders';
      const response = await this.request('GET', endpoint);
      return response;
    } catch (error) {
      logger.error('Failed to get orders:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Check serviceability for pincode
   * 
   * @param {string} pickupPostcode - Pickup pincode
   * @param {string} deliveryPostcode - Delivery pincode
   * @param {number} codAmount - COD amount (0 for prepaid)
   * @param {number} weight - Package weight in kg
   * @returns {Promise<Object>} Serviceability check response
   */
  async checkServiceability(pickupPostcode, deliveryPostcode, codAmount = 0, weight = 0.5) {
    try {
      const response = await this.request('GET', 
        `/courier/serviceability/?pickup_postcode=${pickupPostcode}&delivery_postcode=${deliveryPostcode}&cod=${codAmount > 0 ? 1 : 0}&weight=${weight}`
      );
      
      logger.info('Serviceability checked:', {
        pickup: pickupPostcode,
        delivery: deliveryPostcode,
        available: response.data?.available_courier_companies?.length > 0
      });
      
      return response;
    } catch (error) {
      logger.error('Failed to check serviceability:', {
        pickup: pickupPostcode,
        delivery: deliveryPostcode,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }
}

// Create singleton instance
const shiprocketService = new ShiprocketService();

module.exports = shiprocketService;
