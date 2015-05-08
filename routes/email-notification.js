'use strict';

var nodemailer = require( 'nodemailer' );
var async = require( 'async' );
var _ = require( 'lodash' );
var jade = require( 'jade' );

var KioskMapper = require( '../data_mappers/KioskMapper' );
var kiosk_mapper = new KioskMapper();


var getLastDayProfitForKiosk = function ( kiosk, callback ) {

  callback( null, {

    name: kiosk.name,
    buys: _.random( 200 ),
    sells: _.random( 200 )
  
  } );

}


var day_profit_email_template = jade.compileFile( './views/emails/dayProfitsEmail.jade' );

exports.sendDayProfitsEmail = function ( request, response ) {

  async.waterfall( [

    function ( callback ) {

      kiosk_mapper.findAll( callback );

    },

    function ( kiosks, callback ) {

      async.map( kiosks, getLastDayProfitForKiosk, callback );

    },

    function ( kiosks_profits, callback ) {

      var transporter = nodemailer.createTransport( JSON.parse( process.env.NODEMAILER_TRANSPORTER ) );

      var default_email_options = JSON.parse( process.env.NODEMAILER_MAIL );

      var subject = 'Day Profit Summary';

      var html = day_profit_email_template( { kiosks_profits: kiosks_profits } );

      var mail_options = _.merge( {}, default_email_options, { subject: subject, html: html } );

      transporter.sendMail( mail_options, callback );

    }

  ], function ( error, result ) {

    if ( error ) {

      console.error( 'Error while sending email notification: ' + error );

      return response.send( 500, error );

    }

    return response.send( 200 );

  } );

}
