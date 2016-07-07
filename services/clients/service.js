class ClientService{

  constructor(knex){
    this.knex = knex;
  }

  create(client, callback){

    let error = (error) => {
      console.error(error);
      callback(error);
    }
    
    this.knex('clients')
    .insert(client)
    .returning('*')
    .then(rows => {
      callback(null, rows[0])
    })
    .catch(error);
  }

  find(client,callback) {

    this.knex.select('*')
    .from('clients')
    .where(client)
    .then(rows => {
      callback(null,rows[0]);
    })
    .catch(error => callback(error));
  }
}

module.exports = ClientService;
