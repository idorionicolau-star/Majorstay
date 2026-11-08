import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, doc, setDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
    projectId: "atrevamoneytracker",
    appId: "1:882443102074:web:17ba3de56b34350bd718c3",
    apiKey: "AIzaSyB4HFV5VZ9FU3vQ3bu04KV_sHhioECJqNo",
    authDomain: "atrevamoneytracker.firebaseapp.com",
    storageBucket: "atrevamoneytracker.firebasestorage.app",
    messagingSenderId: "882443102074"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
    console.log("Signing in...");
    const userCredential = await signInWithEmailAndPassword(auth, "trialtest1740125449000@example.com", "password123");
    const uid = userCredential.user.uid;

    const companiesSnap = await getDocs(query(collection(db, "companies"), where("name", "==", "Trial Test Corp")));
    if (companiesSnap.empty) throw new Error("Company not found");
    const companyId = companiesSnap.docs[0].id;
    console.log("Company ID:", companyId);

    // 1. Add Bolo de Chocolate to Catalog
    const catRef = collection(db, `companies/${companyId}/catalogProducts`);

    // Find category Padaria
    const categoriesSnap = await getDocs(collection(db, `companies/${companyId}/catalogCategories`));
    let padariaCat = categoriesSnap.docs.find(d => d.data().name === 'Padaria');
    let categoryId = padariaCat ? padariaCat.id : "cat-padaria";

    const boloRef = await addDoc(catRef, {
        name: "Bolo de Chocolate",
        category: categoryId,
        price: 20,
        unit: "un"
    });

    const paoRef = await addDoc(catRef, {
        name: "Pão Francês",
        category: categoryId,
        price: 1,
        unit: "un"
    });

    console.log("Added catalog products.");

    // get raw materials
    const rawSnap = await getDocs(collection(db, `companies/${companyId}/rawMaterials`));
    const rawMaterials = rawSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const farinha = rawMaterials.find(r => r.name.toLowerCase().includes('farinha'));
    const ovos = rawMaterials.find(r => r.name.toLowerCase().includes('ovos'));
    const acucar = rawMaterials.find(r => r.name.toLowerCase().includes('acucar') || r.name.toLowerCase().includes('açúcar'));

    if (!farinha || !ovos || !acucar) {
        console.error("Missing raw materials!", { farinha, ovos, acucar });
        process.exit(1);
    }

    // 2. Add Recipes
    const recipesRef = collection(db, `companies/${companyId}/recipes`);
    await addDoc(recipesRef, {
        finalProductId: boloRef.id,
        finalProductName: "Bolo de Chocolate",
        ingredients: [
            { rawMaterialId: farinha.id, name: farinha.name, quantity: 0.5, unit: farinha.unit },
            { rawMaterialId: ovos.id, name: ovos.name, quantity: 4, unit: ovos.unit },
            { rawMaterialId: acucar.id, name: acucar.name, quantity: 0.3, unit: acucar.unit }
        ]
    });

    await addDoc(recipesRef, {
        finalProductId: paoRef.id,
        finalProductName: "Pão Francês",
        ingredients: [
            { rawMaterialId: farinha.id, name: farinha.name, quantity: 1, unit: farinha.unit },
            { rawMaterialId: acucar.id, name: acucar.name, quantity: 0.05, unit: acucar.unit }
        ]
    });

    console.log("Added recipes.");

    // 3. Add Orders
    const ordersRef = collection(db, `companies/${companyId}/orders`);
    await addDoc(ordersRef, {
        clientId: "client-1",
        clientName: "João Silva",
        productId: boloRef.id,
        productName: "Bolo de Chocolate",
        quantity: 2,
        status: "Pendente",
        deliveryDate: new Date(Date.now() + 86400000).toISOString(),
        createdAt: serverTimestamp(),
        totalValue: 40
    });

    await addDoc(ordersRef, {
        clientId: "client-2",
        clientName: "Padaria da Esquina",
        productId: paoRef.id,
        productName: "Pão Francês",
        quantity: 50,
        status: "Pendente",
        deliveryDate: new Date(Date.now() + 86400000).toISOString(),
        createdAt: serverTimestamp(),
        totalValue: 50
    });

    console.log("Added orders. Done.");
    process.exit(0);
}

run().catch(console.error);
