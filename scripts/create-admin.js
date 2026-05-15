/**
 * Script para crear el primer usuario administrador en Firebase
 * Uso: node scripts/create-admin.js
 * 
 * 1. Instala firebase-admin: npm install firebase-admin --save-dev
 * 2. Descarga tu serviceAccountKey.json desde Firebase Console > Proyecto > Configuración > Cuentas de servicio
 * 3. Coloca el archivo en scripts/serviceAccountKey.json
 * 4. Ejecuta: node scripts/create-admin.js
 */

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

async function createAdmin() {
  const email = "admin@ifsolucionesautomotrices.com";
  const password = "Admin2024!";
  const displayName = "Administrador IF";

  try {
    // Crear usuario en Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    console.log("✅ Usuario creado en Auth:", userRecord.uid);

    // Crear documento en Firestore
    await db.collection("usuarios").add({
      uid: userRecord.uid,
      email,
      displayName,
      role: "admin",
      activo: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Documento creado en Firestore");
    console.log("\n📋 Credenciales:");
    console.log("   Email:", email);
    console.log("   Password:", password);
    console.log("\n⚠️  Cambia la contraseña después del primer ingreso");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    process.exit(0);
  }
}

createAdmin();
