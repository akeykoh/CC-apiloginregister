const admin = require("firebase-admin");
const functions = require("firebase-functions");
const express = require("express");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const serviceAccount = require('./trashcare-387803-firebase-adminsdk-hi4at-f6df30114e');
const libPhoneNumber = require('google-libphonenumber');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();

app.use(express.json());

const generateUserId = (email) => {
  const prefix = email.substring(0, 3).toUpperCase(); // Mengambil 3 huruf pertama dari email pengguna untuk userId
  const timestamp = Date.now().toString();
  const randomString = Math.random().toString(36).substring(2, 10);

  return prefix + timestamp + randomString;
};

const phoneUtil = libPhoneNumber.PhoneNumberUtil.getInstance();

// Untuk skema pengisian phoneNumber
const phoneNumberSchema = Joi.string().custom((value, helpers) => {
  try {
    const phoneNumber = phoneUtil.parseAndKeepRawInput(value, 'ID');
    if (!phoneUtil.isValidNumber(phoneNumber)) {
      throw new Error('Nomor telepon tidak valid');
    }
    return value;
  } catch (error) {
    throw new Error('Nomor telepon tidak valid');
  }
}).required().messages({
  'any.required': 'Nomor telepon wajib diisi',
  'string.base': 'Nomor telepon harus berupa teks',
  'string.custom': 'Nomor telepon tidak valid',
});

// Skema pengisian data register
const registerPayloadSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email yang dimasukkan tidak valid',
    'any.required': 'Email tidak boleh kosong',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password minimal harus terdiri dari 6 karakter',
    'any.required': 'Password tidak boleh kosong',
  }),
  name: Joi.string()
  .regex(/^[a-zA-Z\s]+$/)
  .required()
  .messages({
    'string.pattern.base': 'Nama hanya boleh terdiri dari huruf alfabet',
    'any.required': 'Nama wajib diisi',
  }),
  phoneNumber: phoneNumberSchema,
  bankName: Joi.string()
  .regex(/^[a-zA-Z\s]+$/)
  .required()
  .messages({
    'string.pattern.base': 'Nama bank hanya boleh terdiri dari huruf alfabet',
    'any.required': 'Nama bank wajib diisi',
  }),
  accountName: Joi.string()
  .regex(/^[a-zA-Z\s]+$/)
  .required()
  .messages({
    'string.pattern.base': 'Nama rekening hanya boleh terdiri dari huruf alfabet',
    'any.required': 'Nama rekening wajib diisi',
  }),
  accountNumber: Joi.string().pattern(/^[0-9]+$/).max(20).required().messages({
    'string.pattern.base': 'Nomor rekening hanya boleh berisi angka',
    'string.max': 'Nomor rekening harus memiliki panjang maksimal 20 digit',
    'any.required': 'Nomor rekening wajib diisi',
  }),
});

const registerHandler = async (req, res) => {
  try {
    const { error } = registerPayloadSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessage = error.details.map((err) => err.message);
      return res.status(400).json({ message: errorMessage });
    }

    const { email, password, name, phoneNumber, bankName, accountName, accountNumber } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const formattedPhoneNumber = phoneUtil.format(phoneUtil.parse(phoneNumber, 'ID'), libPhoneNumber.PhoneNumberFormat.E164);

    const emailExists = await admin.firestore().collection("users").where("email", "==", email).limit(1).get();
    if (!emailExists.empty) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    const phoneNumberExists = await admin.firestore().collection("users").where("phoneNumber", "==", formattedPhoneNumber).limit(1).get();
    if (!phoneNumberExists.empty) {
      return res.status(400).json({ message: "Nomor telepon sudah terdaftar" });
    }
    
    const userRecord = await admin.auth().createUser({
      email,
      password: hashedPassword,
    });

    const userId = generateUserId(email); // Membuat user ID

    await admin.auth().updateUser(userRecord.uid, {
      displayName: name,
      phoneNumber: formattedPhoneNumber,
    });

    const userData = {
      email: userRecord.email,
      password: hashedPassword,
      userId,
      name,
      phoneNumber: formattedPhoneNumber,
      bankName,
      accountName,
      accountNumber,
    };

    const firestore = admin.firestore();
    await firestore.collection("users").doc(userRecord.uid).set(userData);

    return res.status(200).json({ message: "Registrasi berhasil" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Registrasi gagal", error });
  }
};

// Skema pengisian data login
const loginPayloadSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email yang dimasukkan tidak valid',
    'any.required': 'Email tidak boleh kosong',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password minimal harus terdiri dari 6 karakter',
    'any.required': 'Password tidak boleh kosong',
  }),
});

const loginHandler = async (req, res) => {
  try {
    const { error } = loginPayloadSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessage = error.details.map((err) => err.message);
      return res.status(400).json({ message: errorMessage });
    }

    const { email, password } = req.body;

    const userSnapshot = await admin.firestore().collection("users").where("email", "==", email).limit(1).get();

    if (userSnapshot.empty) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userData.userId;

    const storedPassword = userData.password;

    const passwordMatch = await bcrypt.compare(password, storedPassword);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    // Membuat custom token
    const customToken = await admin.auth().createCustomToken(userId);

    await userDoc.ref.update({ customToken });

    return res.status(200).json({ message: "Login berhasil", customToken, userId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Login gagal", error });
  }
};

app.post("/register", registerHandler);
app.post("/login", loginHandler);

exports.apiloginregister = functions.https.onRequest(app);

// Tes di local
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});