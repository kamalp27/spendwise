import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller.js';

const router = Router();

router.get('/categories', CategoryController.getCategories);
router.post('/categories', CategoryController.createCategory);

export default router;
