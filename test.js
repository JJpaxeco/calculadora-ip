const assert = require('assert');
const C = require('./ip-core.js');

function eq(actual, expected, label){ assert.strictEqual(actual, expected, label); }

const v4 = C.parseCIDR4('192.168.10.37/24');
eq(C.intToIPv4(v4.network),'192.168.10.0','IPv4 network');
eq(C.intToIPv4(v4.broadcast),'192.168.10.255','IPv4 broadcast');
eq(v4.usable.toString(),'254','IPv4 usable');
eq(C.maskToPrefix4('255.255.255.192'),26,'mask prefix');
eq(C.parseCIDR4('10.0.0.0/31').usable.toString(),'2','/31 usable');

const v6 = C.parseCIDR6('2001:0db8:0000:0000:0000:ff00:0042:8329/64');
eq(C.compressedIPv6(v6.ip),'2001:db8::ff00:42:8329','IPv6 compression');
eq(C.expandedIPv6(C.parseIPv6('::1').value),'0000:0000:0000:0000:0000:0000:0000:0001','IPv6 expansion');
eq(C.parseCIDR6('2001:db8:1234:10::25/64').cidr,'2001:db8:1234:10::/64','IPv6 network');
eq(C.subnet6('2001:db8::/126',128,0,4).items.length,4,'IPv6 subdivision');

const eui = C.addressFromEUI64('2001:db8::/64','00:1A:2B:3C:4D:5E');
eq(C.compressedIPv6(eui.address),'2001:db8::21a:2bff:fe3c:4d5e','EUI64');

const vlsm = C.allocateVLSM4('192.168.0.0/24','LAN: 100\nCFTV: 30');
eq(vlsm.allocations[0].cidr,'192.168.0.0/25','VLSM largest');
eq(vlsm.allocations[1].cidr,'192.168.0.128/27','VLSM next');

const cmp = C.compareCIDRs('10.0.0.0/8','10.20.0.0/16');
eq(cmp.aContainsB,true,'contains');

console.log('Todos os testes passaram.');
