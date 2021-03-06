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

let services = require('../index');

class OauthService {

  constructor(knex) {
    this.knex = knex;
  }

  getUser(username, password, callback) {
    services.users.find({ username, password }, callback);
  };

  getClient(clientId, clientSecret, callback) {
    services.clients.find({id: clientId}, function(error, client){
      if (error) { callback(error); }
      callback(null, {
        clientId: client.id,
        clientSecret: client.secret,
        redirectUri: client.redirect_uri
      });
    });
  };

  getAccessToken(bearerToken, callback) {
    services.accessTokens.find({value: bearerToken},function(error, token){
      if (error) { callback(error); }
      callback(null, {
        accessToken: token.value,
        clientId: token.client_id,
        expires: token.expires_in,
        userId: token.user_id
      });
    });
  };

  // renamed to saveToken in version 3.x
  saveAccessToken(accessToken, clientId, expires, user, callback) {
    services.accessTokens.create({
      value: accessToken,
      expires_in: expires,
      client_id: clientId,
      user_id: user.id
    }, callback);
  };

  // renamed to getAuthorizationCode in version 3.x
  getAuthCode(bearerCode,callback) {
    services.codes.find({value: bearerCode}, function(error, code){
      if (error) { callback(error); }
      callback(null,{
        clientId: code.client_id,
        expires: code.expires_in * 1000,
        userId: code.user_id
      })
    });
  };

  // renamed to saveAuthorizationCode in versin 3.x
  saveAuthCode(authCode, clientId, expires, user, callback) {
    services.codes.create({
      value: authCode,
      expires_in: parseInt(expires / 1000, 10),
      client_id: clientId,
      user_id: user.id
    }, callback);
  };

  createResourcePermission(userHasResources, callback) {
    this.knex.raw(
      'INSERT INTO ' +
        'users_has_resources (user_id, resource_id, resource_type, options) ' +
      'VALUES ' +
        '(?,?,?,?) ' + //1,2,3,4
      'ON CONFLICT ' +
        '(user_id, resource_id, resource_type) ' +
      'DO UPDATE SET ' +
        'options = ? ' + //5
      'RETURNING *',
      [
        userHasResources.user_id,
        userHasResources.resource_id,
        userHasResources.resource_type,
        userHasResources.options,
        userHasResources.options
      ]
    )
    .then(resultset => {
      callback(null, resultset.rows[0])
    })
    .catch(error => callback(error));
  };

  deleteResourcePermission(userHasResources, callback){
    var raw = this.knex.raw;
    this.knex('users_has_resources')
    .where('user_id', userHasResources.userId)
    .andWhere('resource_id', userHasResources.resourceId)
    .andWhere('resource_type', userHasResources.resourceType)
    .del()
    .then(isDeleted => {
      callback(null,isDeleted);
    })
    .catch(error => callback(error));
  };

  ownedBy(userId, resourceType, callback){
    var raw = this.knex.raw;

    this.knex.select([
      'users_has_resources.options',
      `${resourceType}.id`,
      `${resourceType}.name`,
      `${resourceType}.uri`
    ])
    .from('users_has_resources')
    .join(resourceType, function() {
      this.on('users_has_resources.resource_id', '=', `${resourceType}.id`)
      .on('users_has_resources.user_id', '=', raw('?', [userId]))
      .on('users_has_resources.resource_type', '=', raw('?', [resourceType]))
      .on('users_has_resources.permission', '=', raw('?', [true]))
    })
    .then(rows => {
      callback(null,rows);
    })
    .catch(error => callback(error));
  };

  getResourcePermission(userId, resourceType, resourceId, callback) {
    var raw = this.knex.raw;

    this.knex.select([
      'users_has_resources.*',
      `${resourceType}.name`,
      `${resourceType}.uri`
    ])
    .from('users_has_resources')
    .join(resourceType, function() {
      this.on('users_has_resources.resource_id', '=', `${resourceType}.id`)
      .on('users_has_resources.user_id', '=', raw('?', [userId]))
      .on('users_has_resources.resource_type', '=', raw('?', [resourceType]))
      .on('users_has_resources.resource_id', '=', raw('?', [resourceId]))
    })
    .then(rows => {
      if(rows[0]){
        var resourcePermission = rows[0];
        callback(null, {
          name: resourcePermission.name,
          uri: resourcePermission.uri,
          userId: resourcePermission.user_id,
          resourceId: resourcePermission.resource_id,
          resourceType: resourcePermission.resource_type,
          createdAt: resourcePermission.created_at,
          options: resourcePermission.options,
          permission: resourcePermission.permission
        });
      }else{
        callback(null,null);
      }
    })
    .catch(error => callback(error));
  };

  getRefreshToken(bearerToken, callback) {
    services.accessTokens.find({refresh_token: bearerToken}, function(error, accessToken){
      if (error) { callback(error) }
      callback(null,{
        clientId: accessToken.client_id,
        expires: accessToken.refresh_token_expires_in,
        userId: accessToken.user_id
      });
    });
  };

  revokeRefreshToken(token, callback) {
    services.accessTokens.revokeRefreshToken(token, (error) => {
      if (error) {
        callback(error);
        return;
      }
       callback();
     });
  };

  saveRefreshToken(refreshToken, clientId, expires, user, callback) {
    this.knex('access_tokens')
    .returning('*')
    .where('client_id', '=', clientId)
    .andWhere('user_id', '=', user.id)
    .update({
      refresh_token: refreshToken,
      refresh_token_expires_in: expires
    })
    .then(rows => {
      callback(null,rows);
    })
    .catch(error => {
      callback(error)
    });
  };


  /**
  TODO: refactor
  This will very much depend on your setup, I wouldn't advise doing anything exactly like this but
  it gives an example of how to use the method to resrict certain grant types
  var authorizedClientIds = ['1234215215', 'def2'];
  **/
  grantTypeAllowed(clientId, grantType, callback) {
    // LOGIC TO CHECK IF THE grantType is allowed for the particular clientId
    return callback(false,true);
    if (grantType === 'password') {
        return callback(false, /*authorizedClientIds.indexOf(clientId.toLowerCase()) >= 0*/true);
    }
  };
}

module.exports = OauthService;
