import mongoose from 'mongoose';

const MONGO_URI = 'mongodb://localhost:27017/Nestt';

async function debug() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const PaymentTransactionSchema = new mongoose.Schema({
            tx_ref: String,
            status: String,
            amount: Number,
            currency: String,
            chapaResponse: mongoose.Schema.Types.Mixed,
            createdAt: Date,
            updatedAt: Date,
        }, { timestamps: true });

        const PaymentTransaction = mongoose.model('PaymentTransaction', PaymentTransactionSchema);

        const lastTransactions = await PaymentTransaction.find()
            .sort({ createdAt: -1 })
            .limit(5);

        console.log('--- Last 5 Transactions ---');
        lastTransactions.forEach((tx, i) => {
            console.log(`\n[${i + 1}] TX_REF: ${tx.tx_ref}`);
            console.log(`    Status: ${tx.status}`);
            console.log(`    Amount: ${tx.amount} ${tx.currency}`);
            console.log(`    ChapaResponse: ${JSON.stringify(tx.chapaResponse, null, 2)}`);
            console.log(`    Updated At: ${tx.updatedAt}`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

debug();
