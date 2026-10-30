// Adapter registry. To add a hand-coded integration, create providers/<name>.js exporting
// { label, verticals, credentialFields, settingFields, flights?, hotels?, cars?, test } and add it here.
module.exports = {
  mock: require('./mock'),
  amadeus: require('./amadeus'),
  duffel: require('./duffel'),
  travelpayouts: require('./travelpayouts'),
  generic: require('./generic'),
};
