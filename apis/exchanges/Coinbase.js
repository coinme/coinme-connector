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


Coinbase.prototype._handleError = function ( error, method, callback ) {

  callback( 'Coinbase #' + method + ' error: ' + error );

}


Coinbase.prototype._formattedOrder = function ( order ) {

  return {

    'id': order.id,
    'order_id': order.id,
    'datetime': new Date( order.created_at ),
    'type': order.side,
    'fee': parseFloat( order.fill_fees ),
    'fiat': parseFloat( order.size ) * parseFloat( order.price ),
    'xbt': parseFloat( order.size )

  }

}


Coinbase.prototype._placeOrder = function ( order_type, amount, price, callback ) {

  var self = this;

  async.waterfall( [

    function ( callback ) {

      self.authedClient[ order_type ]( { price: price, size: amount, product_id: 'BTC-USD' }, callback );

    },

    function ( response, order, callback ) {

      self.authedClient.getOrder( order.id, callback );

    }

  ], function ( error, response, order ) {

    if ( error ) return self._handleError( error, order_type, callback );

    var fiat = parseFloat( order.size ) * parseFloat( order.price );

    callback( null, self._formattedOrder( order ) );

  } );

}


Coinbase.prototype.buy = function ( amount, price, callback ) {

  this._placeOrder( 'buy', amount, price, callback );

};


Coinbase.prototype.sell = function ( amount, price, callback ) {

  this._placeOrder( 'sell', amount, price, callback );

};


Coinbase.prototype.getPrices = function ( callback ) {

  var self = this;

  self.publicClient.getProductOrderBook( { level: 1 }, function ( error, response, result ) {

    if ( error ) return self._handleError( error, 'getPrices', callback );
    
    callback( null, {

      'buyPrice': result.asks[ 0 ][ 0 ],
      'sellPrice': result.bids[ 0 ][ 0 ]

    });

  });

};


Coinbase.prototype.getBalance = function ( callback ) {

  var self = this;

  async.parallel( {

    balance: function ( callback ) { self.coinbaseAccount.getBalance( callback ); },

    sell_price: function ( callback ) { self.coinbaseClient.getSellPrice( {}, callback ); }

  }, function ( error, result ) {

    if ( error ) return self._handleError( error, 'getBalance', callback );

    var btc_available = parseFloat( result.balance.amount );

    var fiat_available = btc_available * parseFloat( result.sell_price.subtotal.amount );

    callback( null, {

      'btc_available': btc_available,
      'fiat_available': fiat_available

    } );

  } );

};


Coinbase.prototype.getDepositAddress = function ( callback ) {

  var self = this;

  self.coinbaseAccount.getAddress( function ( error, result ) {

    if ( error ) return self._handleError( error, 'getDepositAddress', callback );

    callback( null, {

      'address': result.address

    } );

  } );

};


Coinbase.prototype.withdraw = function ( amount, address, callback ) {

  var self = this;

  self.coinbaseAccount.sendMoney( { to: address, amount: amount }, function ( error, transaction ) {

    if ( error ) return self._handleError( error, 'withdraw', callback );

    callback( null );

  } );

};


Coinbase.prototype.userTransactions = function ( callback ) {

  var self = this;

  this.authedClient.getOrders( { limit: 100 }, function ( error, response, orders ) {

    if ( error ) return self._handleError( error, 'userTransactions', callback );

    var result_orders = _.map( orders, self._formattedOrder );

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

      coinbase = null;

    }

  }

} )( Coinbase );
