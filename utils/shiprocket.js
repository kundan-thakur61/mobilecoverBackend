const axios = require('axios');
const logger = require('./logger');

/**
 * Shiprocket API Integration Service
 * 
 * Features:
 * - Email/password authentication with token-based session
 * - Shipment creation and management
 * - Real-time tracking
 * - Serviceability check
 * - Pickup location management
 * 
 * Documentation: https://apidocs.shiprocket.in/
 */

class ShiprocketService {
  constructor() {
    this.baseUrl = process.env.SHIPROCKET_API_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';
    this.email = process.env.SHIPROCKET_EMAIL;
    this.password = process.env.SHIPROCKET_PASSWORD;
    this.token = null;
    this.tokenExpiry = null;
    this.isTestEnv = process.env.NODE_ENV === 'test';

    // Log configuration on startup
    logger.info('🔧 Shiprocket Service Configuration:', {
      baseUrl: this.baseUrl,
      hasEmail: !!this.email,
      hasPassword: !!this.password,
      emailConfigured: this.email ? 'Yes' : 'No',
      passwordConfigured: this.password ? 'Yes' : 'No'
    });
  }

  /**
   * Authenticate with Shiprocket API to get access token
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    if (!this.email || !this.password) {
      throw new Error('SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD environment variables are required');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        email: this.email,
        password: this.password
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        
        // Set expiry to 23 hours (tokens typically last 24 hours)
        this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
        
        logger.info('✅ Shiprocket authentication successful');
        return this.token;
      } else {
        throw new Error('Invalid response from Shiprocket authentication API');
      }
    } catch (error) {
      logger.error('❌ Shiprocket authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Get authentication headers with token
   */
  async getAuthHeaders() {
    const token = await this.authenticate();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make authenticated API request with retry logic
   */
  async request(method, endpoint, data = null, retryCount = 0) {
    const maxRetries = 2;

    try {
      const headers = await this.getAuthHeaders();

      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers,
        timeout: 30000 // 30 second timeout
      };

      if (data) {
        config.data = data;
      }

      logger.info(`🚀 Shiprocket API Request: ${method} ${endpoint}`);
      const response = await axios(config);
      logger.info(`✅ Shiprocket API Response: ${response.status}`);

      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      const message = error.message;

      logger.error(`❌ Shiprocket API error [${method} ${endpoint}]:`, {
        status,
        data: errorData,
        message,
        retryCount
      });

      // Retry on certain errors
      if (retryCount < maxRetries && (
        status === 429 || // Rate limit
        status === 500 || // Server error
        status === 502 || // Bad gateway
        status === 503 || // Service unavailable
        status === 504 || // Gateway timeout
        !error.response // Network error
      )) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        logger.info(`🔄 Retrying Shiprocket API request in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(method, endpoint, data, retryCount + 1);
      }

      // For authentication errors, clear token and retry once
      if (status === 401 && retryCount === 0) {
        logger.warn('🔐 Authentication failed, clearing token and retrying...');
        this.token = null;
        this.tokenExpiry = null;
        return this.request(method, endpoint, data, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Mock implementation for development/testing
   */
  mockRequest(method, endpoint, data = null) {
    logger.info(`🎭 Mock request: [${method}] ${endpoint}`);
    
    const mockShipmentId = `MOCK-SR-${Date.now()}`;
    const mockOrderId = `MOCK-ORDER-${Date.now()}`;
    const mockAwbCode = `SR${Date.now()}`;
    
    switch (true) {
      // Order creation
      case endpoint.includes('/orders/create/adhoc'):
        return {
          order_id: parseInt(mockOrderId.replace('MOCK-ORDER-', '')),
          shipment_id: parseInt(mockShipmentId.replace('MOCK-SR-', '')),
          awb_code: mockAwbCode,
          tracking_url: `https://shiprocket.co/tracking/${mockAwbCode}`,
          status: 'success',
          isMock: true
        };
      
      // Tracking
      case endpoint.includes('/courier/track'):
        return {
          status: 'success',
          data: {
            awb_code: data?.awb_code || mockAwbCode,
            status: 'Delivered',
            status_details: 'Delivered',
            current_location: 'Mumbai',
            current_status: 'Delivered',
            tracking_data: {
              history: [
                {
                  status: 'Delivered',
                  substatus: 'Delivered to Customer',
                  created_at: new Date().toISOString(),
                  location: 'Mumbai',
                  activity: 'Delivered to customer'
                },
                {
                  status: 'Out for Delivery',
                  substatus: 'Out for Delivery',
                  created_at: new Date(Date.now() - 3600000).toISOString(),
                  location: 'Mumbai Hub',
                  activity: 'Out for delivery'
                }
              ],
              current_status: {
                status: 'Delivered',
                substatus: 'Delivered to Customer',
                created_at: new Date().toISOString(),
                location: 'Mumbai',
                activity: 'Delivered to customer'
              }
            }
          }
        };
      
      // Serviceability check
      case endpoint.includes('/courier/serviceability'):
        return {
          status: 'success',
          data: {
            available_courier_companies: [
              {
                courier_company_id: 1,
                courier_name: 'Delhivery (Mock)',
                etd: '2-3 days',
                freight_charge: 45.50,
                estimated_delivery_days: 3,
                min_weight_grams: 100,
                max_weight_grams: 10000
              },
              {
                courier_company_id: 2,
                courier_name: 'Bluedart (Mock)',
                etd: '1-2 days',
                freight_charge: 65.00,
                estimated_delivery_days: 2,
                min_weight_grams: 100,
                max_weight_grams: 15000
              }
            ]
          }
        };
      
      // Pickup locations
      case endpoint.includes('/settings/company/pickup-point/list'):
        return {
          status: 'success',
          data: [
            {
              id: 1,
              pickup_location: 'Primary Warehouse',
              name: 'Primary Warehouse',
              company_name: 'Your Company',
              email: 'warehouse@example.com',
              phone: '9876543210',
              address: '123 Main Street',
              city: 'Mumbai',
              state: 'Maharashtra',
              country: 'India',
              pin_code: '400001'
            }
          ]
        };
      
      default:
        return {
          success: true,
          message: `Mock response for ${method} ${endpoint}`,
          data: data || {},
          timestamp: new Date().toISOString()
        };
    }
  }

  /**
   * Create order and shipment in Shiprocket
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} Shiprocket order response
   */
  async createOrder(orderData) {
    try {
      const {
        orderId,
        orderDate,
        pickupLocationId,
        billingCustomerName,
        billingAddress,
        billingCity,
        billingPincode,
        billingState,
        billingCountry = 'India',
        billingEmail,
        billingPhone,
        shippingCustomerName,
        shippingAddress,
        shippingCity,
        shippingPincode,
        shippingState,
        shippingCountry = 'India',
        shippingEmail,
        shippingPhone,
        orderItems = [],
        paymentMethod = 'Prepaid',
        subTotal = 0,
        length = 17,
        breadth = 4,
        height = 2,
        weight = 0.15 // Default 0.15 kg
      } = orderData;

      // Prepare Shiprocket order payload
      // Use the pickup location name if available, otherwise fall back to ID
      const pickupLocationValue = orderData.pickupLocationName || (pickupLocationId || '1');
      
      const shiprocketPayload = {
        order_id: orderId,
        order_date: orderDate || new Date().toISOString().split('T')[0],
        pickup_location: pickupLocationValue, // Use pickup location name or ID
        channel_id: null,
        comment: `Order from CoverGhar - ${orderId}`,
        billing_customer_name: billingCustomerName,
        billing_last_name: '',
        billing_address: billingAddress,
        billing_city: billingCity,
        billing_pincode: billingPincode,
        billing_state: billingState,
        billing_country: billingCountry,
        billing_email: billingEmail,
        billing_phone: billingPhone,
        shipping_is_billing: 0, // 0 means separate shipping address
        shipping_customer_name: shippingCustomerName,
        shipping_last_name: '',
        shipping_address: shippingAddress,
        shipping_city: shippingCity,
        shipping_pincode: shippingPincode,
        shipping_state: shippingState,
        shipping_country: shippingCountry,
        shipping_email: shippingEmail,
        shipping_phone: shippingPhone,
        order_items: orderItems.map(item => ({
          name: item.name || item.title || 'Product',
          sku: item.sku || `ITEM-${Date.now()}`,
          units: item.units || item.quantity || 1,
          selling_price: item.selling_price || item.price || 0,
          discount: item.discount || 0,
          tax: item.tax || 0,
          hsn: item.hsn || '999999'
        })),
        payment_method: paymentMethod === 'COD' ? 'COD' : 'Prepaid',
        shipping_charges: 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        coupon_code: '',
        coupon_discount: 0,
        length: length,
        breadth: breadth,
        height: height,
        weight: Math.min(Math.max(weight, 0.05), 30), // Shiprocket expects kg; bound to 0.05-30kg
        sub_total: subTotal
      };

      logger.info('📦 Creating Shiprocket shipment:', {
        orderId,
        customer: shippingCustomerName,
        city: shippingCity,
        pincode: shippingPincode,
        paymentMethod,
        total: subTotal,
        weight: weight
      });

      // Try the actual API - no fallback to mock
      const response = await this.request('POST', '/orders/create/adhoc', shiprocketPayload);

      // Check if response is in error format (with message and data)
      if (response.message && response.data && !response.order_id) {
        // This is an error response format
        // Check if it's the specific pickup location error
        if (response.message && response.message.toLowerCase().includes('pickup location')) {
          logger.warn('Shiprocket pickup location error:', response.message);
          // Extract available pickup locations from the response
          // The response.data.data could be an array or an object with numeric keys
          let availableLocations = response.data?.data || [];
          
          // If response.data.data is an object (not an array), convert it to array
          if (availableLocations && typeof availableLocations === 'object' && !Array.isArray(availableLocations)) {
            availableLocations = Object.values(availableLocations);
          }
          
          // Parse the available locations from the error message as well
          // Match the location name and ID pattern in the error message
          const locationMatch = response.message.match(/Available pickup locations: ([^(]+) \(ID: ([^)]+)\)/);
          
          if (locationMatch) {
            // Parse the location info from the error message
            // locationMatch[1] is the location name, locationMatch[2] is the ID
            const locationName = locationMatch[1].trim();
            const locationId = locationMatch[2].trim();
            
            logger.info('Parsing location from error message:', { locationName, locationId });
            
            // Retry the request with the correct pickup location name
            const retryPayload = { ...shiprocketPayload, pickup_location: locationName };
            logger.info('Retrying with corrected pickup location name:', { pickupLocationName: locationName });
              
            logger.info('Attempting retry with corrected pickup location name:', { correctedName: locationName });
            try {
              const retryResponse = await this.request('POST', '/orders/create/adhoc', retryPayload);
                
              // If retry succeeds, return the result
              if (retryResponse.order_id) {
                logger.info('✅ Shiprocket shipment created on retry:', {
                  orderId: retryResponse.order_id,
                  shipmentId: retryResponse.shipment_id,
                  awbCode: retryResponse.awb_code
                });
                  
                return {
                  success: true,
                  orderId: retryResponse.order_id,
                  shipmentId: retryResponse.shipment_id,
                  awbCode: retryResponse.awb_code,
                  trackingUrl: retryResponse.tracking_url,
                  status: 'success',
                  message: 'Shipment created successfully after correcting pickup location'
                };
              } else {
                // If the retry response doesn't have an order_id, it means it still failed
                logger.warn('Retry with corrected pickup location name also failed:', {
                  retryResponse,
                  originalMessage: response.message
                });
              }
            } catch (retryError) {
              logger.error('Retry attempt failed with error:', {
                retryErrorMessage: retryError.message,
                originalMessage: response.message
              });
              // Continue with original error handling if retry fails
            }
          } else if (availableLocations && availableLocations.length > 0) {
            // If regex didn't match but we have available locations in data, try using the first one
            // This handles cases where the error message is generic but data contains the valid locations
            const firstLocation = availableLocations[0];
            const locationName = firstLocation.pickup_location || firstLocation.name;
            
            if (locationName) {
              logger.info('Using location from response data for retry:', { locationName });
              
              const retryPayload = { ...shiprocketPayload, pickup_location: locationName };
              
              try {
                const retryResponse = await this.request('POST', '/orders/create/adhoc', retryPayload);
                  
                if (retryResponse.order_id) {
                  logger.info('✅ Shiprocket shipment created on retry (using data):', {
                    orderId: retryResponse.order_id,
                    shipmentId: retryResponse.shipment_id,
                    awbCode: retryResponse.awb_code
                  });
                    
                  return {
                    success: true,
                    orderId: retryResponse.order_id,
                    shipmentId: retryResponse.shipment_id,
                    awbCode: retryResponse.awb_code,
                    trackingUrl: retryResponse.tracking_url,
                    status: 'success',
                    message: 'Shipment created successfully after correcting pickup location'
                  };
                }
              } catch (retryError) {
                logger.warn('Retry with data-derived location failed:', retryError.message);
                // Continue to throw original error
              }
            }
          }
          
          if (Array.isArray(availableLocations) && availableLocations.length > 0) {
            logger.info('Available pickup locations:', availableLocations.map(loc => ({ id: loc.id, name: loc.pickup_location || loc.name, address: loc.address })), {
              accountId: process.env.SHIPROCKET_EMAIL
            });
            
            // Provide a more informative error message
            const locationInfo = availableLocations.map(loc => 
              `${loc.pickup_location || loc.name} (ID: ${loc.id}) - ${loc.address}`
            ).join('; ');
            
            throw new Error(
              response.message + 
              `. Available pickup locations: ` + locationInfo + 
              `. Please update your Shiprocket account configuration or contact support.`
            );
          }
        }
        
        // If we reach here, it means we couldn't parse the location from the error message
        // and should throw the original error
        throw new Error(response.message || 'Shiprocket API returned an error');
      }
      
      // If we have an order_id directly in the response, use it as success
      if (response.order_id) {
        logger.info('✅ Shiprocket shipment created:', {
          orderId: response.order_id,
          shipmentId: response.shipment_id,
          awbCode: response.awb_code
        });

        return {
          success: true,
          orderId: response.order_id,
          shipmentId: response.shipment_id,
          awbCode: response.awb_code,
          trackingUrl: response.tracking_url,
          status: 'success',
          message: 'Shipment created successfully'
        };
      }
      
      // Handle both direct response format and nested data format
      const responseOrderId = response.order_id || (response.data && response.data.order_id) || null;
      const responseShipmentId = response.shipment_id || (response.data && response.data.shipment_id) || null;
      const responseAwbCode = response.awb_code || (response.data && response.data.awb_code) || null;
      const responseTrackingUrl = response.tracking_url || (response.data && response.data.tracking_url) || null;

      // If we have no order_id after all processing, check if we got an error message
      if (!responseOrderId && response.message && response.data) {
        // This is an error response that wasn't caught earlier
        throw new Error(response.message || 'Shiprocket API returned an error');
      }

      logger.info('✅ Shiprocket shipment created:', {
        orderId: responseOrderId,
        shipmentId: responseShipmentId,
        awbCode: responseAwbCode
      });

      return {
        success: true,
        orderId: responseOrderId,
        shipmentId: responseShipmentId,
        awbCode: responseAwbCode,
        trackingUrl: responseTrackingUrl,
        status: 'success',
        message: 'Shipment created successfully'
      };
    } catch (error) {
      logger.error('❌ Failed to create Shiprocket shipment:', {
        orderId: orderData.orderId,
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Track shipment by AWB code
   * @param {string} awbCode - AWB code
   * @returns {Promise<Object>} Tracking information
   */
  async trackShipment(awbCode) {
    try {
      logger.info('📍 Tracking Shiprocket shipment:', { awbCode });

      try {
        const response = await this.request('GET', `/courier/track?awb=${awbCode}`);

        // Handle different response formats from Shiprocket API
        if (response && (response.status === 'success' || response.awb_code || response.data)) {
          // Use response.data if available, otherwise use the response object itself
          const trackingData = response.data || response;
          logger.info('✅ Tracking data retrieved for:', { awbCode });
          return trackingData;
        } else {
          throw new Error('Invalid tracking response from Shiprocket API');
        }
      } catch (apiError) {
        if (this.isTestEnv) {
          logger.info('🎭 Falling back to mock implementation in test env due to API error:', apiError.message);
          return this.mockRequest('GET', '/courier/track', { awb_code: awbCode }).data;
        }
        throw apiError;
      }
    } catch (error) {
      logger.error('❌ Failed to track shipment:', {
        awbCode,
        error: error.message
      });

      if (this.isTestEnv) {
        logger.info('🎭 Falling back to mock implementation in test env');
        return this.mockRequest('GET', '/courier/track', { awb_code: awbCode }).data;
      }
      throw error;
    }
  }

  /**
   * Check serviceability for pincode
   * @param {string} pickupPin - Pickup pincode
   * @param {string} deliveryPin - Delivery pincode
   * @param {number} codAmount - COD amount (0 for prepaid)
   * @param {number} weight - Package weight in kg
   * @returns {Promise<Object>} Serviceability information
   */
  async checkServiceability(pickupPin, deliveryPin, codAmount = 0, weight = 0.5) {
    try {
      logger.info('🔍 Checking serviceability:', {
        pickup: pickupPin,
        delivery: deliveryPin
      });

      try {
        // For GET request, we need to send parameters as query string
        const boundedWeight = Math.min(Math.max(weight || 0.5, 0.05), 30);
        const queryString = `?pickup_postcode=${pickupPin}&delivery_postcode=${deliveryPin}&cod=${codAmount > 0 ? 1 : 0}&weight=${boundedWeight}`;
        const response = await this.request('GET', `/courier/serviceability${queryString}`);

        // Check if response has the expected data structure
        // Shiprocket API might return different response formats
        if (response && (response.data || response.available_courier_companies)) {
          // Use response.data if available, otherwise use the response object itself
          const responseData = response.data || response;
          
          logger.info('✅ Serviceability check completed for:', { deliveryPin });
          return {
            success: true,
            serviceable: responseData.available_courier_companies && responseData.available_courier_companies.length > 0,
            data: responseData
          };
        } else {
          throw new Error('Invalid serviceability response from Shiprocket API');
        }
      } catch (apiError) {
        if (this.isTestEnv) {
          logger.info('🎭 Falling back to mock implementation in test env due to API error:', apiError.message);
          const mockResult = this.mockRequest('GET', '/courier/serviceability', { 
            pickup_postcode: pickupPin, 
            delivery_postcode: deliveryPin 
          });
          
          return {
            success: true,
            serviceable: true,
            data: mockResult.data,
            isMock: true
          };
        }
        throw apiError;
      }
    } catch (error) {
      logger.error('❌ Serviceability check failed:', {
        pickup: pickupPin,
        delivery: deliveryPin,
        error: error.message
      });

      if (this.isTestEnv) {
        logger.info('🎭 Falling back to mock implementation for serviceability in test env');
        return {
          success: true,
          serviceable: true,
          data: this.mockRequest('GET', '/courier/serviceability', { 
            pickup_postcode: pickupPin, 
            delivery_postcode: deliveryPin 
          }).data,
          isMock: true
        };
      }
      throw error;
    }
  }

  /**
   * Get pickup locations
   * @returns {Promise<Array>} List of pickup locations
   */
  async getPickupLocations() {
    try {
      logger.info('🏢 Fetching pickup locations from Shiprocket');

      try {
        // Try the standard endpoint first
        let response;
        try {
          response = await this.request('GET', '/settings/company/pickup-point/list');
        } catch (firstAttemptError) {
          // If the standard endpoint fails, try alternative endpoints
          logger.info('Standard pickup location endpoint failed, trying alternatives...');
          
          // Try alternative endpoint
          try {
            response = await this.request('GET', '/settings/company/addresses');
          } catch (secondAttemptError) {
            logger.info('Alternative pickup location endpoint also failed');
            
            // As a last resort, return the mock implementation
            return this.mockRequest('GET', '/settings/company/pickup-point/list').data;
          }
        }

        // Handle different response formats from Shiprocket API
        if (response && (response.status === 'success' || response.data)) {
          // Use response.data if available, otherwise use the response object itself
          const locationsData = response.data || response;
          logger.info('✅ Retrieved pickup locations:', {
            count: Array.isArray(locationsData) ? locationsData.length : 0
          });
          return Array.isArray(locationsData) ? locationsData : [];
        } else {
          throw new Error('Invalid pickup locations response from Shiprocket API');
        }
      } catch (apiError) {
        if (this.isTestEnv) {
          logger.info('🎭 Falling back to mock implementation in test env due to API error:', apiError.message);
          return this.mockRequest('GET', '/settings/company/pickup-point/list').data;
        }
        throw apiError;
      }
    } catch (error) {
      logger.error('❌ Failed to get pickup locations:', error.message);

      if (this.isTestEnv) {
        logger.info('🎭 Falling back to mock implementation in test env');
        return this.mockRequest('GET', '/settings/company/pickup-point/list').data;
      }
      throw error;
    }
  }

  /**
   * Cancel shipment
   * @param {string} awbCode - AWB code to cancel
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelShipment(awbCode) {
    try {
      logger.info('🚫 Cancelling Shiprocket shipment:', { awbCode });

      try {
        const response = await this.request('DELETE', `/shipment/cancel?awb=${awbCode}`);

        logger.info('✅ Shipment cancelled:', { awbCode });
        return response;
      } catch (apiError) {
        if (this.isTestEnv) {
          logger.info('🎭 Falling back to mock implementation in test env due to API error:', apiError.message);
          return this.mockCancelShipment(awbCode);
        }
        throw apiError;
      }
    } catch (error) {
      logger.error('❌ Failed to cancel shipment:', {
        awbCode,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      if (this.isTestEnv) {
        logger.info('🎭 Falling back to mock implementation in test env');
        return this.mockCancelShipment(awbCode);
      }
      throw error;
    }
  }

  /**
   * Mock implementation for shipment cancellation
   * @param {string} awbCode - AWB code to cancel
   * @returns {Object} Mock cancellation response
   */
  mockCancelShipment(awbCode) {
    logger.info('🎭 Mock cancellation for AWB:', { awbCode });
    
    return {
      success: true,
      message: 'Shipment cancelled successfully (mock)',
      awb_code: awbCode,
      status: 'cancelled',
      isMock: true
    };
  }

  /**
   * Generate shipping label
   * @param {Array} shipmentIds - Array of shipment IDs
   * @returns {Promise<Object>} Label generation response
   */
  async generateLabel(shipmentIds) {
    try {
      logger.info('🏷️ Generating shipping labels for shipments:', { shipmentIds });

      try {
        const response = await this.request('POST', '/courier/generate/label', {
          shipment_ids: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds]
        });

        logger.info('✅ Labels generated for shipments:', { shipmentIds });
        return response;
      } catch (apiError) {
        if (this.isTestEnv) {
          logger.info('🎭 Falling back to mock implementation in test env due to API error:', apiError.message);
          return this.mockGenerateLabel(shipmentIds);
        }
        throw apiError;
      }
    } catch (error) {
      logger.error('❌ Failed to generate labels:', {
        shipmentIds,
        error: error.message
      });

      if (this.isTestEnv) {
        logger.info('🎭 Falling back to mock implementation in test env');
        return this.mockGenerateLabel(shipmentIds);
      }
      throw error;
    }
  }

  /**
   * Mock implementation for label generation
   * @param {Array} shipmentIds - Array of shipment IDs
   * @returns {Object} Mock label generation response
   */
  mockGenerateLabel(shipmentIds) {
    logger.info('🎭 Mock label generation for shipments:', { shipmentIds });
    
    return {
      success: true,
      message: 'Labels generated successfully (mock)',
      shipment_ids: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds],
      label_urls: Array.isArray(shipmentIds) ? 
        shipmentIds.map(id => `https://mock-labels.com/label-${id}`) : 
        [`https://mock-labels.com/label-${shipmentIds[0]}`],
      isMock: true
    };
  }

  /**
   * Get recommended couriers for an order
   * @param {string} pickupPin - Pickup pincode
   * @param {string} deliveryPin - Delivery pincode
   * @param {number} codAmount - COD amount (0 for prepaid)
   * @param {number} weight - Package weight in kg
   * @returns {Promise<Object>} Recommended couriers
   */
  async getRecommendedCouriers(pickupPin, deliveryPin, codAmount = 0, weight = 0.5) {
    try {
      logger.info('🚚 Getting recommended couriers:', {
        pickup: pickupPin,
        delivery: deliveryPin
      });

      const serviceability = await this.checkServiceability(pickupPin, deliveryPin, codAmount, weight);

      if (serviceability.success && serviceability.data?.available_courier_companies) {
        // Sort couriers by price (ascending)
        const sortedCouriers = serviceability.data.available_courier_companies
          .sort((a, b) => a.freight_charge - b.freight_charge);

        logger.info('✅ Retrieved recommended couriers:', {
          count: sortedCouriers.length
        });

        return {
          success: true,
          couriers: sortedCouriers,
          count: sortedCouriers.length
        };
      } else {
        return {
          success: false,
          couriers: [],
          count: 0,
          message: 'No couriers available for this route'
        };
      }
    } catch (error) {
      logger.error('❌ Failed to get recommended couriers:', {
        pickup: pickupPin,
        delivery: deliveryPin,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Request pickup for shipments
   * @param {Array} shipmentIds - Array of shipment IDs
   * @param {string} pickupDate - Pickup date (YYYY-MM-DD)
   * @param {string} pickupTimeFrom - Pickup time from (HH:MM)
   * @param {string} pickupTimeTo - Pickup time to (HH:MM)
   * @returns {Promise<Object>} Pickup request response
   */
  async requestPickup(shipmentIds, pickupDate = null, pickupTimeFrom = '10:00', pickupTimeTo = '18:00') {
    try {
      logger.info('🚛 Requesting pickup for shipments:', { 
        shipmentIds, 
        pickupDate: pickupDate || new Date().toISOString().split('T')[0] 
      });

      try {
        const response = await this.request('POST', '/courier/shipments/pickup/create', { // Updated endpoint for pickup requests
          shipment_id: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds],
          pickup_date: pickupDate || new Date().toISOString().split('T')[0],
          pickup_time_from: pickupTimeFrom,
          pickup_time_to: pickupTimeTo
        });

        logger.info('✅ Pickup requested for shipments:', { shipmentIds });
        return response;
      } catch (apiError) {
        if (this.isTestEnv) {
          logger.info('🎭 Falling back to mock implementation in test env due to API error:', apiError.message);
          return this.mockRequestPickup(shipmentIds, pickupDate);
        }
        throw apiError;
      }
    } catch (error) {
      logger.error('❌ Failed to request pickup:', {
        shipmentIds,
        error: error.message
      });

      if (this.isTestEnv) {
        logger.info('🎭 Falling back to mock implementation in test env');
        return this.mockRequestPickup(shipmentIds, pickupDate);
      }
      throw error;
    }
  }

  /**
   * Mock implementation for pickup request
   * @param {Array} shipmentIds - Array of shipment IDs
   * @param {string} pickupDate - Pickup date
   * @returns {Object} Mock pickup request response
   */
  mockRequestPickup(shipmentIds, pickupDate) {
    logger.info('🎭 Mock pickup request for shipments:', { shipmentIds });
    
    return {
      success: true,
      message: 'Pickup requested successfully (mock)',
      shipment_ids: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds],
      pickup_date: pickupDate || new Date().toISOString().split('T')[0],
      status: 'pickup_scheduled',
      isMock: true
    };
  }
}

// Create singleton instance
const shiprocketService = new ShiprocketService();

module.exports = shiprocketService;