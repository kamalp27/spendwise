import { Router } from 'express';
import { ExpenseController } from '../controllers/expense.controller.js';

const router = Router();

router.get('/expenses', ExpenseController.getExpenses);
router.get('/expenses/:id', ExpenseController.getExpenseById);
router.post('/expenses', ExpenseController.createExpense);
router.patch('/expenses/:id', ExpenseController.updateExpense);
router.delete('/expenses/:id', ExpenseController.deleteExpense);

export default router;
