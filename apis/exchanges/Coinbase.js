'use strict';

var CoinbaseAPI = require( 'coinbase' ); 
var CoinbaseExchange = require( 'coinbase-exchange' );
var async = require( 'async' );
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

  this.exchangePublic = new CoinbaseExchange.PublicClient();

  this.exchangeClient = new CoinbaseExchange.AuthenticatedClient(

    config[ 'coinbase.exchangePublicKey' ],
    config[ 'coinbase.secret' ],
    config[ 'coinbase.passphrase' ]

  );

};


var handleError = function ( error, method, callback ) {

  if ( error ) {

    callback( 'Coinbase #' + method + ' error: ' + error );

    return true;

  }

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

      self.exchangeClient[ order_type ]( { size: amount, price: price, product_id: 'BTC-USD' }, callback );

    },

    function ( response, order, callback ) {

      if ( order.message ) return callback( order.message );

      self.exchangeClient.getOrder( order.id, callback );

    }

  ], function ( error, response, order ) {

    if ( handleError( error, order_type, callback ) ) return;

    var formatted_order = formattedOrder( order );

    callback( null, formatted_order );

  } );

};


Coinbase.prototype.buy = function ( amount, price, callback ) {

  placeOrder( this, 'buy', amount, price, callback );

};


Coinbase.prototype.sell = function ( amount, price, callback ) {

  placeOrder( this, 'sell', amount, price, callback );

};


Coinbase.prototype.getPrices = function ( callback ) {

  this.exchangePublic.getProductOrderBook( { level: 1 }, function ( error, response, result ) {

    if ( handleError( error, 'getPrices', callback ) ) return;
    
    callback( null, {

      'buyPrice': parseFloat( result.asks[ 0 ][ 0 ] ),
      'sellPrice': parseFloat( result.bids[ 0 ][ 0 ] )

    });

  });

};


Coinbase.prototype.getBalance = function ( callback ) {

  var self = this;

  async.parallel( {

    usual: function ( callback ) { 

      self.coinbaseAccount.getBalance( callback );

    },

    exchange: function ( callback ) {

      self.exchangeClient.getAccounts( function ( error, response, accounts ) {

        if ( error ) return callback( error );

        callback( null, accounts[ 0 ] )

      } );

    }

  }, function ( error, accounts ) {

    if ( handleError( error, 'getBalance', callback ) ) return;

    callback( null, {

      'btc_available': parseFloat( accounts.usual.amount ),
      'fiat_available': parseFloat( accounts.exchange.available )

    } );

  } );

};


Coinbase.prototype.getDepositAddress = function ( callback ) {

  this.coinbaseAccount.getAddress( function ( error, result ) {

    if ( handleError( error, 'getDepositAddress', callback ) ) return;

    callback( null, {

      'address': result.address

    } );

  } );

};


Coinbase.prototype.withdraw = function ( amount, address, callback ) {

  this.coinbaseAccount.sendMoney( { amount: amount, to: address }, function ( error, transaction ) {

    if ( handleError( error, 'withdraw', callback ) ) return;

    callback( null );

  } );

};


Coinbase.prototype.userTransactions = function ( callback ) {

  this.exchangeClient.getOrders( { limit: 100 }, function ( error, response, orders ) {

    if ( handleError( error, 'userTransactions', callback ) ) return;

    var formatted_orders = _.map( orders, formattedOrder );

    callback( null, formatted_orders );

  } );

};


Coinbase.prototype.getMinimumOrders = function ( callback ) {

  callback( null, { 

    'minimumBuy': 0.01,
    'minimumSell': 0.01

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
