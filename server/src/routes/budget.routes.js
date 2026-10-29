import { Router } from 'express';
import { BudgetController } from '../controllers/budget.controller.js';

const router = Router();

router.get('/budgets', BudgetController.getBudgets);
router.post('/budgets', BudgetController.createBudget);

export default router;
