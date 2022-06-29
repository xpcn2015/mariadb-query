
import { createLogger } from '@xpcn/logger';
import { createPool, PoolConnection, Pool } from 'mariadb';
import Transport from 'winston-transport';
//
// Inherit from `winston-transport` so you can take advantage
// of the base functionality and `.exceptions.handle()`.
//
export class mariadbTransport extends Transport {


    log(info: { level: string; message: string; from: string; }, callback: () => void) {

        const { level, message, from } = info;
        asyncQuery(from, "INSERT INTO `log` (`level`, `message`, `from`) VALUES (?, ?, ?)", [level, message, from]);

        setImmediate(() => {
            this.emit('logged', info);
        });

        // Perform the writing to the remote service
        callback();
    }
};

const logger = createLogger({
    productionMode: false,
    transports: [new mariadbTransport()]
})

let pool: Pool | undefined = undefined
export type connectionDetails = {
    host: string,
    user: string,
    password: string,
    port?: number,
    database: string,
    connectionLimit?: number,
    timezone?: string,
}
export function createConnection(details: connectionDetails) {
    if (pool) return
    pool = createPool({
        host: details.host,
        user: details.user,
        password: details.password,
        port: details.port || 3306,
        database: details.database,
        connectionLimit: details.connectionLimit || 20,
        timezone: details.timezone || "+00:00"
    });
}

export async function asyncQuery<T = any>(from: string, query: string, bind?: (string | number | Buffer)[]) {
    if (!pool) return false
    let conn: PoolConnection | undefined = undefined
    try {
        conn = await pool.getConnection();
        const res: T = await conn.query(query, bind);
        return res
    } catch (err) {
        logger.dev_error(`Query error => \n${err} `, { from: from });
        return false
    } finally {
        if (conn) conn.end();
    }
}
export type TransactionQuery = {
    sql: string,
    bind?: (string | number | Buffer)[]
}
export async function asyncTransaction(queries: TransactionQuery[], from: string = "asyncTransaction") {
    if (!pool) return false
    let conn: PoolConnection | undefined = undefined
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        let success = true;
        let output = await Promise.all(queries.map(async query => {
            try {
                if (!conn) throw "connection failed"
                let result = await conn.query(query.sql, query.bind)
                return result
            } catch (error) {
                logger.dev_warn(`Transaction error => \n${error} \n reverting changes... `, { from: from });
                success = false;
                throw "some query reported error."
            }
        }))
        success ? await conn.commit() : await conn.rollback();
        return success ? output : false;

    } catch (err) {
        logger.dev_error(`Failed to execute transaction => \n${err} `, { from: from });
        return false
    } finally {
        if (conn) conn.end();
    }
}

