var scope = angular.element(document).find('body').scope();
var game = scope.game;
var units = game.units();
var buyMeat = true;
var buyTerr = true;
var buyEnergy = true;
var autobuy = 0;
var fasterUpgrades = [];

var autoSpeed = 10000;
var mothN4 = 572;
var mothEnd = 4000;
var ascensionCount = units.ascension.count().toNumber();
var batCount = optimalBats();


game.unitlist().forEach(function(u) {
    var upgrade = u.upgrades.byName[u.name + 'prod'];
    if (upgrade != null) {
        fasterUpgrades.push(upgrade);
    }
});

var empowerList = units.territory._parents().map(function(u) {
    return game.upgrade(u.name + 'empower')
});

function optimalBats() {
    var ascensionCount = units.ascension.count().toNumber();
    var ben = Math.round(Math.log(1 / (50 * Math.pow(1.12, ascensionCount))) / Math.log(0.5) * 80000 - 89125);
    var opt = Math.round(Math.sqrt((1440000 / Math.pow(1.2, 2 / 1)) - ((-1200000 + (ben * 6)) / -1.2)) + (1200 / -1.2));

    if (ascensionCount == 0) {
        return 102;
    } else {
        return opt;
    }
}

function unitRatio(u) {
    if (u._producerPath.getCoefficients().length > 1) {
        return u._producerPath.getCoefficientsNow()[1].dividedBy(u.maxCostMetOfVelocity().times(u.twinMult())).toNumber();
    } else {
        return 0;
    }
}

function currentMeat(unit) {
    if (!unit) {
        return currentMeat(units.drone);
    }
    if (unitRatio(unit) > 2) {
        return currentMeat(unit.next);
    } else {
        return unit;
    }
}

function buyMeatTwin(unit, amount) {
    var twin = game.upgrade(unit.name + 'twin');
    var realAmount = amount == 0 ? unit.maxCostMet(1).times(unit.twinMult()) : amount;
    if (twin && unit.next) {
        var parentCost = twin.totalCost()[0].val;
        var parent = twin.totalCost()[0].unit;
        var unitCost = parent.costByName[unit.name].val.dividedBy(parent.twinMult());
		var totalUnitCost = unitCost.times(parentCost);

		console.log('Next meat unit progress:', ((realAmount.toNumber() / totalUnitCost.times(1.5).toNumber()) * 100).toFixed(2) + '%', `(${realAmount.toNumber()} / ${totalUnitCost.times(1.5).toNumber()})`);

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
    } else {
        console.log('Bought', realAmount.toExponential(2), unit.unittype.slug);
        unit.buy(realAmount);
    }
}

function manualTierUp() {
    if (currentMeat().next) {
        buyMeatTwin(currentMeat().next, 0);
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

function unitCostAsPercentOfVelocity(unit, cost) {
    var MAX = new Decimal(9999.99);
    var count = cost.unit.velocity();
    if (count.lessThanOrEqualTo(0)) {
        return MAX;
    }
    return Decimal.min(MAX, cost.val.times(unit.maxCostMetOfVelocity()).dividedBy(count));
}

// var buyList = [game.upgrade('expansion')].concat(units.nexus.upgrades.list);
var buyListProto = _.flatten([units.larva.upgrades.list, units.nexus.upgrades.list, units.meat.upgrades.list, units.territory._parents().map(function(p) {
    return game.upgrade(p.name + 'twin')
})]);
var buyList = buyListProto.slice(0);
var energyBuyList = [];

var buyFunc = function() {
    if (buyEnergy) {
        batCount = optimalBats();
        autoEnergy();
    }

    buyList.forEach(function(u) {
        if (u.isBuyable()) {
            console.log('Bought', u.maxCostMet(1).toNumber(), u.name);
            u.buyMax(1);
        }
    });
    energyBuyList.forEach(function(o) {
            var boughtNum = o.u.maxCostMet(1).toNumber();
            if (boughtNum > o.n) {
                boughtNum = o.n;
            }
            if (o.u.isBuyable()) {
                console.log('Bought', boughtNum, o.u.name);
                o.u.buy(o.n);
            }
        }

    )
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

    var currMeat = currentMeat();
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

var autoEnergy = function() {
    buyList = buyListProto.slice(0);
    energyBuyList = [];
    if (units.moth.count().toNumber() >= mothN4) {
        if (game.upgrade('nexus5').count().toNumber() == 0) {
            buyList = buyList.concat(game.upgrade('nexus5'));
        } else if (units.moth.count().toNumber() < mothEnd) {
            energyBuyList = energyBuyList.concat({
                "u": units.moth,
                "n": mothEnd - units.moth.count().toNumber(),
                "m": mothEnd
            });
        } else if (units.bat.count().toNumber() < batCount) {
            energyBuyList = energyBuyList.concat({
                "u": units.bat,
                "n": batCount - units.bat.count().toNumber(),
                "m": batCount
            });
        } else {
            buyList = buyList.concat(game.upgrade("swarmwarp"));
        }
    } else {
        buyList = buyList.concat(units.moth);
    }
    buyList = buyList.concat(units.energy)
};
