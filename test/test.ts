import { asyncTransaction, createConnection, TransactionQuery } from "../src/index";
createConnection({
    host: "localhost",
    user: "root",
    password: "1234",
    port: 3307,
    database: "boxshop2",
    connectionLimit: 2,
})
async function test() {

    const queries: TransactionQuery[] = []
    queries.push({ sql: "SELECT * FROM user" })

    const result = await asyncTransaction(queries)
    console.log(result)
}
test() 