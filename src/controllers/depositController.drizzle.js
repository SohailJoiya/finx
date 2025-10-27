// Example: src/controllers/depositController.drizzle.ts
import { db } from "../db/client";
import { deposits } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export const createDeposit = async (req, res) => {
  try {
    const { amount, transactionId } = req.body;
    if (!req.file) return res.status(400).json({ message: "Screenshot required" });
    const screenshotPath = `/uploads/deposits/${req.file.filename}`;

    const [row] = await db.insert(deposits).values({
      userId: req.user.id, // NOTE: use numeric id in SQL world
      amount,
      transactionId: transactionId || null,
      screenshot: screenshotPath,
      status: "Pending",
    }).returning();

    res.status(201).json({ deposit: row, message: "Deposit submitted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getUserDeposits = async (req, res) => {
  try {
    const rows = await db.select().from(deposits)
      .where(eq(deposits.userId, req.user.id))
      .orderBy(desc(deposits.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
