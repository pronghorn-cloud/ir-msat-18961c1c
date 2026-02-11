import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
  listStatuses,
  listOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  listAccessRecords,
  listSettlements,
  listProjectTypes,
  getAccessRecordById,
  createAccessRecord,
  updateAccessRecord,
  deleteAccessRecord,
  getMapData
} from '../controllers/lapController.js';

const router = express.Router();

// All LAP routes require staff or admin auth
router.use(authenticate, authorize('staff', 'admin'));

// Applications
router.get('/statuses', listStatuses);
router.get('/applications', listApplications);
router.get('/applications/:id', getApplicationById);
router.post('/applications', createApplication);
router.put('/applications/:id', updateApplication);
router.delete('/applications/:id', deleteApplication);

// Orders
router.get('/orders', listOrders);
router.get('/orders/:id', getOrderById);
router.post('/orders', createOrder);
router.put('/orders/:id', updateOrder);
router.delete('/orders/:id', deleteOrder);

// Map
router.get('/map-data', getMapData);

// Access Records
router.get('/access-records/settlements', listSettlements);
router.get('/access-records/project-types', listProjectTypes);
router.get('/access-records', listAccessRecords);
router.get('/access-records/:id', getAccessRecordById);
router.post('/access-records', createAccessRecord);
router.put('/access-records/:id', updateAccessRecord);
router.delete('/access-records/:id', deleteAccessRecord);

export default router;
