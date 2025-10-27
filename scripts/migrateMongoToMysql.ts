// scripts/migrateMongoToMysql.ts
// Run with: ts-node scripts/migrateMongoToMysql.ts
import { MongoClient, ObjectId } from "mongodb";
import { db } from "../src/db/client";
import { users, deposits, withdrawals, notifications, profitHistory, referralCommissions, monthlyRewards, systemSettings } from "../src/db/schema";
import { eq } from "drizzle-orm";

const uri = process.env.MONGO_URI!;

async function main() {
  const mc = new MongoClient(uri);
  await mc.connect();
  const mdb = mc.db();

  // USERS
  const usersCol = mdb.collection("users");
  const allUsers = await usersCol.find({}).toArray();
  const mongoIdToNewId = new Map<string, number>();

  for (const chunk of chunked(allUsers, 500)) {
    const values = chunk.map((u: any) => ({
      mongoId: String(u._id),
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      email: u.email,
      passwordHash: u.password, // Already hashed in Mongo
      role: u.role || "user",
      phone: u.phone || "",
      balance: String(u.balance || 0),
      totalProfit: String(u.totalProfit || 0),
      referralCode: u.referralCode || null,
      // referredBy will be patched in a second pass
    }));
    const rows = await db.insert(users).values(values).returning();
    rows.forEach((r, i) => mongoIdToNewId.set(String(chunk[i]._id), r.id));
  }

  // Patch referredBy
  for (const u of allUsers) {
    const newId = mongoIdToNewId.get(String(u._id))!;
    let referredByUserId = null;
    if (u.referredBy) {
      const refId = mongoIdToNewId.get(String(u.referredBy));
      referredByUserId = refId ?? null;
    }
    await db.update(users).set({ referredByUserId }).where(eq(users.id, newId));
  }

  // DEPOSITS
  const depositsCol = mdb.collection("deposits");
  const allDeposits = await depositsCol.find({}).toArray();
  for (const chunk of chunked(allDeposits, 500)) {
    await db.insert(deposits).values(chunk.map((d: any) => ({
      userId: mongoIdToNewId.get(String(d.user))!,
      amount: String(d.amount),
      transactionId: d.transactionId || null,
      screenshot: d.screenshot,
      status: d.status || "Pending",
      adminReason: d.adminReason || "",
      createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
      updatedAt: d.updatedAt ? new Date(d.updatedAt) : undefined,
    })));
  }

  // WITHDRAWALS
  const withdrawalsCol = mdb.collection("withdrawals");
  const allWithdrawals = await withdrawalsCol.find({}).toArray();
  for (const chunk of chunked(allWithdrawals, 500)) {
    await db.insert(withdrawals).values(chunk.map((w: any) => ({
      userId: mongoIdToNewId.get(String(w.user))!,
      amount: String(w.amount),
      fee: String(w.fee),
      finalAmount: w.finalAmount != null ? String(w.finalAmount) : null,
      walletName: w.walletName,
      network: w.network,
      destinationAddress: w.destinationAddress,
      receivable: String(w.receivable),
      status: w.status || "Pending",
      transactionId: w.transactionId || null,
      createdAt: w.createdAt ? new Date(w.createdAt) : undefined,
      updatedAt: w.updatedAt ? new Date(w.updatedAt) : undefined,
    })));
  }

  // NOTIFICATIONS
  const notesCol = mdb.collection("notifications");
  const allNotes = await notesCol.find({}).toArray();
  for (const chunk of chunked(allNotes, 500)) {
    await db.insert(notifications).values(chunk.map((n: any) => ({
      userId: n.user ? mongoIdToNewId.get(String(n.user))! : null,
      title: n.title,
      message: n.message,
      isRead: !!n.isRead,
      createdAt: n.createdAt ? new Date(n.createdAt) : undefined,
      updatedAt: n.updatedAt ? new Date(n.updatedAt) : undefined,
    })));
  }

  // PROFIT HISTORY
  const phCol = mdb.collection("profithistories");
  const allPH = await phCol.find({}).toArray();
  for (const chunk of chunked(allPH, 500)) {
    await db.insert(profitHistory).values(chunk.map((p: any) => ({
      userId: mongoIdToNewId.get(String(p.user))!,
      type: p.type,
      amount: String(p.amount),
      description: p.description || null,
      createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
    })));
  }

  // REFERRAL COMMISSIONS
  const rcCol = mdb.collection("referralcommissions");
  const allRC = await rcCol.find({}).toArray();
  for (const chunk of chunked(allRC, 500)) {
    await db.insert(referralCommissions).values(chunk.map((r: any) => ({
      fromUserId: r.fromUser ? mongoIdToNewId.get(String(r.fromUser))! : null,
      toUserId: r.toUser ? mongoIdToNewId.get(String(r.toUser))! : null,
      level: r.level,
      amount: String(r.amount),
      createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
    })));
  }

  // MONTHLY REWARDS
  const mrCol = mdb.collection("monthlyrewards");
  const allMR = await mrCol.find({}).toArray();
  for (const chunk of chunked(allMR, 500)) {
    await db.insert(monthlyRewards).values(chunk.map((m: any) => ({
      userId: mongoIdToNewId.get(String(m.user))!,
      month: m.month,
      totalInvestment: String(m.totalInvestment || 0),
      teamInvestment: String(m.teamInvestment || 0),
      achievedTier: m.achievedTier || null,
      rewardAmount: String(m.rewardAmount || 0),
      isClaimed: !!m.isClaimed,
      createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
      updatedAt: m.updatedAt ? new Date(m.updatedAt) : undefined,
    })));
  }

  // SYSTEM SETTINGS (single doc)
  const stCol = mdb.collection("systemsettings");
  const one = await stCol.findOne({});
  if (one) {
    await db.insert(systemSettings).values({
      walletsBinance: one.wallets?.binance || "",
      walletsTrust: one.wallets?.trust || "",
      aboutHtml: one.aboutHtml || "",
    });
  }

  await mc.close();
  console.log("✅ Migration completed");
}

function* chunked(arr: any[], size: number) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
