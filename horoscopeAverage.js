import cassandra from "cassandra-driver";

import config from "./config.js";
const { astra } = config;

const database = new cassandra.Client(astra);

database.execute("SELECT rating FROM filcbot.horoscoperatings;").then((result) => {
    console.log("Értékelések száma:", result.rows.length, "\nÉrtékelések átlaga:g", result.rows.map((row) => row.rating).reduce((partialSum, row) => partialSum + row, 0) / result.rows.length);
    database.shutdown()
})