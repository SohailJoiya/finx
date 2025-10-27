// Example: src/controllers/authController.drizzle.ts
import {db} from '../db/client'
import {users} from '../db/schema'
import {eq} from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import {generateToken} from '../config/jwt'

export const registerUser = async (req, res) => {
  try {
    const {firstName, lastName, email, password, referralCode} = req.body
    const [exists] = await db.select().from(users).where(eq(users.email, email))
    if (exists) return res.status(400).json({message: 'User already exists'})

    const passwordHash = await bcrypt.hash(password, 10)

    // resolve referredBy via referralCode if present
    let referredByUserId = null
    if (referralCode) {
      const [ref] = await db
        .select()
        .from(users)
        .where(eq(users.referralCode, referralCode))
      referredByUserId = ref?.id ?? null
    }

    const referral = Math.random().toString(36).slice(2, 10)
    const [u] = await db
      .insert(users)
      .values({
        mongoId: '', // blank for new SQL-native users
        firstName,
        lastName,
        email,
        passwordHash,
        referralCode: referral,
        referredByUserId,
        role: 'user'
      })
      .returning()

    const token = generateToken({id: u.id, role: u.role})
    res.status(201).json({
      token,
      user: {
        id: u.id,
        firstName,
        lastName,
        email,
        referralCode: referral,
        role: u.role
      }
    })
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}

export const loginUser = async (req, res) => {
  try {
    const {email, password} = req.body
    const [u] = await db.select().from(users).where(eq(users.email, email))
    if (!u) return res.status(401).json({message: 'Invalid credentials'})

    const ok = await bcrypt.compare(password, u.passwordHash)
    if (!ok) return res.status(401).json({message: 'Invalid credentials'})

    const token = generateToken({id: u.id, role: u.role})
    res.json({
      token,
      user: {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role
      }
    })
  } catch (err) {
    res.status(500).json({message: err.message})
  }
}
