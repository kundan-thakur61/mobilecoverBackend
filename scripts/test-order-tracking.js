#!/usr/bin/env node
/**
 * Test Order Tracking Functionality
 * Debug the 404 error for shipment ID tracking
 */

const mongoose = require('mongoose');
const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
require('dotenv').config();

async function testTracking() {
  console.log('🔍 Testing Order Tracking Functionality');
  console.log('=====================================');
  
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database connected');
    
    // Test the specific shipment ID that's failing
    const testShipmentId = '1132563637';
    console.log(`\n🔍 Looking for shipment ID: ${testShipmentId}`);
    
    // Check regular orders
    console.log('\n📦 Checking Regular Orders...');
    const regularOrder = await Order.findOne({
      'deliveryOne.shipmentId': testShipmentId
    });
    
    if (regularOrder) {
      console.log('✅ Found regular order with shipment ID:');
      console.log(`   Order ID: ${regularOrder._id}`);
      console.log(`   Status: ${regularOrder.status}`);
      console.log(`   Shipment ID: ${regularOrder.deliveryOne.shipmentId}`);
      console.log(`   AWB Code: ${regularOrder.deliveryOne.awbCode || 'N/A'}`);
      console.log(`   Waybill: ${regularOrder.deliveryOne.waybill || 'N/A'}`);
    } else {
      console.log('❌ No regular order found with this shipment ID');
    }
    
    // Check custom orders
    console.log('\n🎨 Checking Custom Orders...');
    const customOrder = await CustomOrder.findOne({
      'deliveryOne.shipmentId': testShipmentId
    });
    
    if (customOrder) {
      console.log('✅ Found custom order with shipment ID:');
      console.log(`   Order ID: ${customOrder._id}`);
      console.log(`   Status: ${customOrder.status}`);
      console.log(`   Shipment ID: ${customOrder.deliveryOne.shipmentId}`);
      console.log(`   AWB Code: ${customOrder.deliveryOne.awbCode || 'N/A'}`);
      console.log(`   Waybill: ${customOrder.deliveryOne.waybill || 'N/A'}`);
    } else {
      console.log('❌ No custom order found with this shipment ID');
    }
    
    // Check Shiprocket shipments (alternative location)
    console.log('\n🚢 Checking Shiprocket Shipments...');
    const shiprocketRegular = await Order.findOne({
      'shiprocket.shipmentId': parseInt(testShipmentId)
    });
    
    if (shiprocketRegular) {
      console.log('✅ Found regular order with Shiprocket shipment ID:');
      console.log(`   Order ID: ${shiprocketRegular._id}`);
      console.log(`   Status: ${shiprocketRegular.status}`);
      console.log(`   Shiprocket Shipment ID: ${shiprocketRegular.shiprocket.shipmentId}`);
      console.log(`   AWB Code: ${shiprocketRegular.shiprocket.awbCode || 'N/A'}`);
    } else {
      console.log('❌ No regular order found with Shiprocket shipment ID');
    }
    
    const shiprocketCustom = await CustomOrder.findOne({
      'shiprocket.shipmentId': parseInt(testShipmentId)
    });
    
    if (shiprocketCustom) {
      console.log('✅ Found custom order with Shiprocket shipment ID:');
      console.log(`   Order ID: ${shiprocketCustom._id}`);
      console.log(`   Status: ${shiprocketCustom.status}`);
      console.log(`   Shiprocket Shipment ID: ${shiprocketCustom.shiprocket.shipmentId}`);
      console.log(`   AWB Code: ${shiprocketCustom.shiprocket.awbCode || 'N/A'}`);
    } else {
      console.log('❌ No custom order found with Shiprocket shipment ID');
    }
    
    // List some recent orders with shipment information
    console.log('\n📋 Recent Orders with Shipment Information:');
    const recentOrders = await Order.find({
      $or: [
        { 'deliveryOne.shipmentId': { $exists: true, $ne: null } },
        { 'shiprocket.shipmentId': { $exists: true, $ne: null } }
      ]
    }).sort({ createdAt: -1 }).limit(5);
    
    if (recentOrders.length > 0) {
      recentOrders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order: ${order._id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Created: ${order.createdAt}`);
        
        if (order.deliveryOne?.shipmentId) {
          console.log(`   DeliveryOne Shipment ID: ${order.deliveryOne.shipmentId}`);
        }
        if (order.shiprocket?.shipmentId) {
          console.log(`   Shiprocket Shipment ID: ${order.shiprocket.shipmentId}`);
        }
        if (order.deliveryOne?.waybill) {
          console.log(`   Waybill: ${order.deliveryOne.waybill}`);
        }
        if (order.shiprocket?.awbCode) {
          console.log(`   AWB Code: ${order.shiprocket.awbCode}`);
        }
      });
    } else {
      console.log('No orders with shipment information found');
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('1. The shipment ID 1132563637 was not found in any order');
    console.log('2. This could be because:');
    console.log('   - The shipment was created but not linked to an order');
    console.log('   - The shipment ID belongs to a different system');
    console.log('   - The order was deleted but shipment remains');
    console.log('   - The shipment ID format is incorrect');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
  }
}

// Run the test
testTracking();