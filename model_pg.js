/**
  Authorization Code grant
    getAccessToken
    getClient
    saveAuthorizationCode

  Password grant
    getAccessToken
    getClient
    getUser
    saveToken

  Refresh token grant
    getAccessToken
    getClient
    getRefreshToken
    saveToken

  Client Credentials grant
    getAccessToken
    getClient
    saveToken
**/

var model = module.exports,
    pg    = require('pg'),
    pgConn= 'postgres://postgres:postgres@localhost/oauth';
    // pgp   = require('pg-promise')({}),
    // db    = pgp('postgres://postgres:postgres@localhost/oauth'),

model.getAccessToken = function (bearerToken, callback) {
    db.oauth_access_tokens.find({'access_token': bearerToken}, function (err, users) {
      if (err || !users || !users.length) return callback(err);
      // This object will be exposed in req.oauth.token
      // The user_id field will be exposed in req.user (req.user = { id: '...' }) however if
      // an explicit user object is included (token.user, must include id) it will be exposed
      // in req.user instead
      var token = users[0];
      callback(null, {
        accessToken: token.access_token,
        clientId: token.client_id,
        expires: token.expires,
        userId: token.userId
      });
    });
};

model.getClient = function (clientId, clientSecret, callback) {
  pg.connect(pgConn, function(err, client, done) {
    if (err) {
      return console.error('pg connection error ', err);
    }
    client.query('SELECT * FROM clients WHERE id = $1;', [clientId], function(err, resultClients) {
      done();
      if (err || !resultClients.length) return callback(err);

      var resultClient = resultClients[0];
      if (clientSecret !== null && resultClient.secret !== clientSecret) return callback();
      callback(null, {
        clientId: resultClient.id,
        clientSecret: resultClient.secret,
        redirectUri: resultClient.redirect_uri
      });
    });
  });
};

/* REFRESH TOKEN IS NOT TESTED */
model.getRefreshToken = function (bearerToken, callback) {
  db.oauth_refresh_tokens.find({'refresh_token' : bearerToken}, function(err,users) {
    callback(err, users && users.length ? users[0] : false);
  });
};

// This will very much depend on your setup, I wouldn't advise doing anything exactly like this but
// it gives an example of how to use the method to resrict certain grant types
var authorizedClientIds = ['1234215215', 'def2'];
model.grantTypeAllowed = function (clientId, grantType, callback) {
  // LOGIC TO CHECK IF THE grantType is allowed for the particular clientId
  return callback(false,true);
  if (grantType === 'password') {
      return callback(false, /*authorizedClientIds.indexOf(clientId.toLowerCase()) >= 0*/true);
  }
};

// renamed to saveToken in version 3.x
model.saveAccessToken = function (accessToken, clientId, expires, userId, callback) {
  db.oauth_access_tokens.save({access_token : accessToken, client_id : clientId, user_id: userId, expires: expires},function(err,saved) {
    console.log('err',err);
      callback(err);
  })
  /*
  client.query('INSERT INTO oauth_access_tokens(access_token, client_id, user_id, expires) ' +
      'VALUES ($1, $2, $3, $4)', [accessToken, clientId, userId, expires],
      function (err, result) {
          callback(err);
    });
  */
};

/* REFRESH TOKEN IS NOT TESTED */
model.saveRefreshToken = function (refreshToken, clientId, expires, userId, callback) {
  db.oauth_refresh_tokens.save({refresh_token: refreshToken, client_id: clientId, user_id: userId, expires:expires},function(err,saved) {
    callback(err);
  })
};

/*
 * Required to support password grant type
 */
model.getUser = function (username, password, callback) {
  pg.connect(pgConn, function(err, client, done) {
    if (err) {
      return console.error('pg connection error ', err);
    }
    client.query('SELECT * FROM users WHERE username = $1 AND password = $2;', [username,password], function(err, result) {
      done();
      if(err) {
        return console.error('error running query', err);
      }
      var users = result.rows;
      callback(err, users && users.length ? users[0] : false);
    });
  });
};


//auth code grant type
// renamed to saveAuthorizationCode in versin 3.x
model.saveAuthCode = function(authCode, clientId, expires, user, callback) {
  var code = {
    authCode: authCode,
    clientId: clientId,
    userId: user.id
  };
  if (expires) code.expires = parseInt(expires / 1000, 10);
  db.oauth_codes.save(code, callback);
};

 // renamed to getAuthorizationCode in version 3.x
model.getAuthCode = function(bearerCode,callback) {
  db.oauth_codes.find({authCode: bearerCode},function(err,codes) {
    code = codes[0];
    if (code && code.expires) {
        code.expires = new Date(code.expires * 1000);
    }
    callback(err,code);
  })
};
