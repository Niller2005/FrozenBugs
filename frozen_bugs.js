var scope = angular.element('body').scope();
var game = scope.game;
var units = game.units();
var buyMeat = true;
var buyTerr = true;
var autobuy = 0;
var fasterUpgrades = [];

var optimalBats = [
   102,  370,  394,  417,  440,  463,  485,  507,  528,  549, //000-009
   570,  591,  611,  632,  652,  671,  691,  710,  729,  748, //010-019
   766,  785,  803,  821,  839,  857,  874,  891,  909,  926, //020-029
   943,  959,  976,  993, 1009, 1025, 1041, 1057, 1073, 1089, //030-039
  1104, 1120, 1135, 1150, 1166, 1181, 1196, 1210, 1225, 1240, //040-049
  1254, 1269, 1283, 1297, 1312, 1326, 1340, 1354, 1368, 1381, //050-059
  1395, 1409, 1422, 1436, 1449, 1462, 1476, 1489, 1502, 1515, //060-069
  1528, 1541, 1554, 1566, 1579, 1592, 1604, 1617, 1629, 1642, //070-079
  1654, 1666, 1679, 1691, 1703, 1715, 1727, 1739, 1751, 1763, //080-089
  1775, 1786, 1798, 1810, 1821, 1833, 1844, 1856, 1867, 1879  //090-099
];
var ascensionCount = units.ascension.count().c[0];

var autoSpeed = 10000;
var mothN4 = 572;
var mothEnd = 4000;
var batCount = optimalBats[ascensionCount];

game.unitlist().forEach(function(u) {
  var upgrade = u.upgrades.byName[u.name + 'prod'];
  if (upgrade != null) {
    fasterUpgrades.push(upgrade);
  }
});

var empowerList = units.territory._parents().map(function(u) {return game.upgrade(u.name + 'empower')});

function unitRatio(u) {
  if (u._producerPath.getCoefficients().length > 1) {
    return u._producerPath.getCoefficientsNow()[1].dividedBy(u.maxCostMetOfVelocity().times(u.twinMult())).toNumber();
  } else {
    return 0;
  }
}

function currentMeat(unit) {
  if (unitRatio(unit) > 2) {
    return currentMeat(unit.next);
  } else {
    return unit;
  }
}

function buyMeatTwin(unit, amount) {
  var twin = game.upgrade(unit.name + 'twin');
  var realAmount = amount == 0 ? unit.maxCostMet(1).times(unit.twinMult()) : amount;
  if (twin) {
    var parentCost = twin.totalCost()[0].val;
    var parent = twin.totalCost()[0].unit;
    var unitCost = parent.costByName[unit.name].val.dividedBy(parent.twinMult());
    var totalUnitCost = unitCost.times(parentCost);

    if (totalUnitCost.times(1.5).lessThan(realAmount)) {
      if (!twin.isBuyable()) {
        if (unit.count().lessThan(totalUnitCost)) {
          console.log('Twinning-Bought', totalUnitCost.minus(unit.count()).toExponential(2), unit.unittype.slug);
          unit.buy(unitCost.times(parentCost).minus(unit.count()));
        }
        console.log('Twinning-Bought', parentCost.toExponential(2), parent.unittype.slug);
        buyMeatTwin(parent, parentCost);
      }
      if (twin.isBuyable()) {
        twin.buy(1);
        console.log('Bought Twin', unit.unittype.slug);
        buyMeatTwin(unit, amount);
      }
    } else {
      console.log('Bought', realAmount.toExponential(2), unit.unittype.slug);
      unit.buy(realAmount);
    }
  }
}

function currentTerritory() {
  var current = units.swarmling;
  var currentProd = 0;
  units.territory._parents().forEach(function(u) {
    var uProd = u.maxCostMet(1).times(u.twinMult()).times(u.eachProduction().territory);
    if (uProd.greaterThan(currentProd)) {
      currentProd = uProd;
      current = u;
    }
  });
  return current;
}

function unitCostAsPercentOfVelocity (unit, cost) {
  var MAX = new Decimal(9999.99);
  var count = cost.unit.velocity();
  if (count.lessThanOrEqualTo(0)) {
    return MAX;
  }
  return Decimal.min(MAX, cost.val.times(unit.maxCostMetOfVelocity()).dividedBy(count));
}

// var buyList = [game.upgrade('expansion')].concat(units.nexus.upgrades.list);
var buyListProto = _.flatten([units.larva.upgrades.list, units.nexus.upgrades.list, units.meat.upgrades.list, units.territory._parents().map(function(p){return game.upgrade(p.name + 'twin')})]);
var buyList = buyListProto.slice(0);

var buyFunc = function() {
  buyList.forEach(function(u) {
    if (u.isBuyable()) {
      console.log('Bought', u.maxCostMet(1).toNumber(), u.name);
      u.buyMax(1);
    }
  });
  fasterUpgrades.forEach(function(u) {
    if (u.isBuyable() && u.totalCost()[0].val.times(2).lessThan(u.totalCost()[0].unit.count())) {
      console.log('Bought Faster', u.unit.unittype.slug, u.maxCostMet(1).toNumber(), 'times');
      u.buyMax(1);
    }
  });

  var currTerr = currentTerritory();

  empowerList.forEach(function(u) {
    if (u.isBuyable() && currTerr.eachCost()[0].val.greaterThan(u.unit.eachCost()[0].val) && u.unit.totalProduction().territory.times(1000).lessThan(units.territory.velocity())) {
      console.log('Bought Empower', u.unit.unittype.slug);
      u.buy(1);
    }
  });

  currTerr = currentTerritory();

  if (buyTerr && currTerr.isBuyable()) {
    setTimeout(function() {
	  console.log('Bought', currTerr.maxCostMet(1).times(currTerr.twinMult()).toExponential(2), currTerr.unittype.slug);
	  currTerr.buyMax(1);
	}, 1000);
  }

  var currMeat = currentMeat(units.drone);
  var meatList = unitRatio(currMeat) > 0.01 ? [currMeat.next, currMeat] : [currMeat];

  meatList.forEach(function(m) {
    if (buyMeat && m.isBuyable()) {
      setTimeout(function() {
        buyMeatTwin(m, 0);
      }, 2000)
    }
  });
  autobuy = setTimeout(buyFunc, autoSpeed);
};

var autoEnergy = 0;
var autoEnergyF = function() {
  buyList = buyListProto.slice(0);
  if (units.moth.count().toNumber() >= mothN4) {
    if (game.upgrade('nexus5').count().toNumber() == 0) {
      buyList = buyList.concat(game.upgrade('nexus5'));
      ascensionCount = units.ascension.count().c[0];
      batCount = optimalBats[ascensionCount];
    } else if (units.moth.count().toNumber() < mothEnd) {
      if(mothEnd-units.moth.count().toNumber() > 0){
        console.log('Bought', mothEnd-units.moth.count().toNumber().toExponential(2), units.moth.name);
        units.moth.buy(mothEnd-units.moth.count().toNumber());
      }
    } else if (units.bat.count().toNumber() < batCount) {
      if (batCount-units.bat.count().toNumber() > 0) {
        console.log('Bought', batCount-units.bat.count().toNumber(), units.bat.name);
        units.bat.buy(batCount-units.bat.count().toNumber());
      }
    } else {
      buyList = buyList.concat(game.upgrade("swarmwarp"));
    }
  } else {
    buyList = buyList.concat(units.moth);
  }

  autoEnergy = setTimeout(autoEnergyF, autoSpeed);
};
