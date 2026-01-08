# DeliveryOne Integration Guide

This document explains how to integrate and configure DeliveryOne shipping services with the e-commerce platform.

## Overview

DeliveryOne provides comprehensive shipping and logistics solutions including:
- Order shipment creation
- Courier assignment and tracking
- Pickup scheduling
- Label generation
- Real-time status updates via webhooks

## Configuration

### Environment Variables

Required environment variables for DeliveryOne integration:

```env
DELIVERYONE_EMAIL=your-deliveryone-email@example.com
DELIVERYONE_PASSWORD=your-deliveryone-password
DELIVERYONE_API_BASE_URL=https://api.deliveryone.com/v1
DELIVERYONE_WEBHOOK_SECRET=your-webhook-secret-token
DELIVERYONE_AUTO_CREATE=true
```

### Webhook Setup

The webhook endpoint is located at:
```
POST /api/deliveryone/webhook
```

Configure this URL in your DeliveryOne dashboard under webhook settings.

## API Endpoints

### Public Endpoints
- `GET /api/deliveryone/track/:orderId` - Track shipment (authenticated users)
- `GET /api/deliveryone/check-serviceability` - Check delivery serviceability

### Admin Endpoints
- `POST /api/deliveryone/create-shipment` - Create shipment in DeliveryOne
- `POST /api/deliveryone/assign-courier` - Assign courier and generate AWB
- `GET /api/deliveryone/recommended-couriers/:orderId` - Get available couriers
- `POST /api/deliveryone/request-pickup` - Request courier pickup
- `POST /api/deliveryone/cancel-shipment` - Cancel shipment
- `POST /api/deliveryone/generate-label` - Generate shipping label
- `POST /api/deliveryone/generate-manifest` - Generate manifest for multiple orders
- `GET /api/deliveryone/pickup-locations` - Get configured pickup locations

## Implementation Details

### Order Structure Mapping

The system maps order data to DeliveryOne format:
- Order ID is prefixed with `ORD-` for regular orders or `CUST-` for custom orders
- Customer details are extracted from shipping address
- Product SKUs are normalized to meet DeliveryOne requirements
- Weight and dimensions are calculated based on product specifications

### Webhook Handling

Webhook events trigger automatic order status updates:
- Shipment creation updates order status
- Tracking information is stored for real-time visibility
- Status changes propagate via WebSocket connections
- Failed deliveries trigger appropriate notifications

## Error Handling

Common error scenarios and handling:
- Authentication failures are retried with token refresh
- Network timeouts implement exponential backoff
- Invalid data formats return descriptive error messages
- Missing shipping information prompts admin intervention

## Security

- All API communications use HTTPS
- Authentication tokens are cached securely
- Webhook requests are validated with shared secrets
- Sensitive data is encrypted at rest

## Troubleshooting

### Common Issues
- Verify API credentials in environment variables
- Check webhook secret matches between server and DeliveryOne dashboard
- Confirm webhook URL is publicly accessible
- Review logs for detailed error information

### Debugging Tips
- Enable verbose logging for API requests
- Test webhook endpoints with DeliveryOne's testing tools
- Monitor rate limits and implement appropriate delays
- Validate order data before submission to DeliveryOne