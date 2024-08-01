const express = require('express');
const logger = require('morgan');

const app = express();
const path = require('path');
const {PrismaSessionStore} = require('@quixo3/prisma-session-store');
const session = require('express-session');
const prisma = require('./config/prisma');

app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.use(logger('dev'));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(
  session({
    secret: 'sessionsecretchangelater',
    resave: true,
    saveUninitialized: true,
    cookie: {maxAge: 7 * 24 * 60 * 60 * 1000},
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

const indexRouter = require('./routes/index');
const fileRouter = require('./routes/file');

app.use('/', indexRouter);
app.use('/file', fileRouter);

app.use((err, req, res, next) => {
  console.log(err);
  res.status(err.statusCode || 500).send(err.message);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('server listening on port ' + port);
});
