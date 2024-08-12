const express = require('express');
const logger = require('morgan');

const app = express();
const path = require('path');
const {PrismaSessionStore} = require('@quixo3/prisma-session-store');
const session = require('express-session');
const prisma = require('./config/prisma');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

app.use(express.json());
app.use(express.urlencoded({extended: false}));

app.use(logger('dev'));

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(
  session({
    secret: process.env.SESSION_SECRET,
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

app.use(helmet());
app.use(compression());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
  })
);
const indexRouter = require('./routes/index');
const folderRouter = require('./routes/folder');
const fileRouter = require('./routes/file');

app.use('/', indexRouter);
app.use('/folder', folderRouter);
app.use('/file', fileRouter);

app.use((err, req, res, next) => {
  console.log(err);
  req.session.error = 'An unexpected error happened';
  res.redirect('/');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('server listening on port ' + port);
});
