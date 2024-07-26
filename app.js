const express = require("express");
const logger = require("morgan");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(logger("dev"));

app.use((err, req, res, next) => {
	console.log(err);
	res.status(err.statusCode || 500).send(err.message);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log("server listening on port " + port);
});
