'use strict';

var CoinbaseAPI = require('coinbase'); 
var CoinbaseExchange = require('coinbase-exchange');
var async = require('async');
var _ = require( 'lodash' );


var Coinbase = function ( config ) {
    
  this.coinbaseClient = new CoinbaseAPI.Client( {

    apiKey: config[ 'coinbase.coinbaseAPIKey' ],
    apiSecret: config[ 'coinbase.coinbaseAPISecret' ]

  } );

  this.coinbaseAccount = new CoinbaseAPI.model.Account(

    this.coinbaseClient,
    { id: config[ 'coinbase.coinbaseAccountID' ] }

  );

  this.publicClient = new CoinbaseExchange.PublicClient();

  this.authedClient = new CoinbaseExchange.AuthenticatedClient(

    config[ 'coinbase.exchangePublicKey' ],
    config[ 'coinbase.secret' ],
    config[ 'coinbase.passphrase' ]

  );

};


var handleError = function ( error, method, callback ) {

  callback( 'Coinbase #' + method + ' error: ' + error );

};


var formattedOrder = function ( order ) {

  return {

    'id': order.id,
    'order_id': order.id,
    'datetime': new Date( order.created_at ),
    'type': order.side,
    'fee': parseFloat( order.fill_fees ),
    'fiat': parseFloat( order.size ) * parseFloat( order.price ),
    'xbt': parseFloat( order.size )

  };

};


var placeOrder = function ( self, order_type, amount, price, callback ) {

  async.waterfall( [

    function ( callback ) {

      self.authedClient[ order_type ]( { size: amount, price: price, product_id: 'BTC-USD' }, callback );

    },

    function ( response, order, callback ) {

      if ( order.message ) return callback( order.message );

      self.authedClient.getOrder( order.id, callback );

    }

  ], function ( error, response, order ) {

    if ( error ) return handleError( error, order_type, callback );

    callback( null, formattedOrder( order ) );

  } );

};


Coinbase.prototype.buy = function ( amount, price, callback ) {

  placeOrder( this, 'buy', amount, price, callback );

};


Coinbase.prototype.sell = function ( amount, price, callback ) {

  placeOrder( this, 'sell', amount, price, callback );

};


Coinbase.prototype.getPrices = function ( callback ) {

  this.publicClient.getProductOrderBook( { level: 1 }, function ( error, response, result ) {

    if ( error ) return handleError( error, 'getPrices', callback );
    
    callback( null, {

      'buyPrice': parseFloat( result.asks[ 0 ][ 0 ] ),
      'sellPrice': parseFloat( result.bids[ 0 ][ 0 ] )

    });

  });

};


Coinbase.prototype.getBalance = function ( callback ) {

  this.coinbaseClient.getAccount( this.coinbaseAccount.id, function ( error, account ) {

    if ( error ) return handleError( error, 'getBalance', callback );

    callback( null, {

      'btc_available': parseFloat( account.balance.amount ),
      'fiat_available': parseFloat( account.native_balance.amount )

    } );

  } );

};


Coinbase.prototype.getDepositAddress = function ( callback ) {

  this.coinbaseAccount.getAddress( function ( error, result ) {

    if ( error ) return handleError( error, 'getDepositAddress', callback );

    callback( null, {

      'address': result.address

    } );

  } );

};


Coinbase.prototype.withdraw = function ( amount, address, callback ) {

  this.coinbaseAccount.sendMoney( { amount: amount, to: address }, function ( error, transaction ) {

    if ( error ) return handleError( error, 'withdraw', callback );

    callback( null );

  } );

};


Coinbase.prototype.userTransactions = function ( callback ) {

  this.authedClient.getOrders( { limit: 100 }, function ( error, response, orders ) {

    if ( error ) return handleError( error, 'userTransactions', callback );

    var result_orders = _.map( orders, formattedOrder );

    callback( null, result_orders );

  } );

};


Coinbase.prototype.getMinimumOrders = function ( callback ) {

  callback( null, { 

    'minimumBuy': 0.005,
    'minimumSell': 0.005 

  } );

};


Coinbase.prototype.getRequiredConfirmations = function () {
  
  return 6;

};


module.exports = ( function ( Constructor ) {

  var instance = null;

  return {

    getInstance: function ( config ) {

      if ( instance === null ) instance = new Constructor( config );

      return instance;

    },

    clearInstance: function () {

      instance = null;

    }

  };

} )( Coinbase );
