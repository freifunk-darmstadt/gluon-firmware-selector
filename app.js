/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var app = function(){
  var app = {};

  var config = {
    imageBasePath: './images/',
    gluonPrefix: 'gluon-ffda-',
    vendors: {
      "8devices": "8devices",
      "alfa": "ALFA Network",
      "allnet": "Allnet",
      "buffalo": "Buffalo",
      "d-link": " D-Link",
      "gl": "GL Innovations",
      "linksys": "Linksys",
      "meraki": "Meraki",
      "netgear": "Netgear",
      "onion": "Onion",
      "openmesh": "Open-Mesh",
      "tp-link": "TP-Link",
      "ubiquiti": "Ubiquiti",
      "wd": "Western Digital",
      "x86": "-"
    },
    typeNames: {
      "factory": "Erstinstallation",
      "sysupgrade": "Upgrade"
    }
  };

  var IGNORED_ELEMENTS = ['../', 'Name', 'Last modified', 'Size', 'Description',
                          'Parent Directory', 'SHA256SUMS', 'stable.manifest',
                          'beta.manifest', 'experimental.manifest'];

  var PANE = {'MODEL': 0, 'IMAGETYPE': 1, 'BRANCH': 2};

  var wizard = {
    "tab": 1,
    "vendor": -1,
    "model": -1,
    "branch": -1,
    "revision": -1,
    "type": -1
  };

  app.currentVersions = {};

  var routers = {};

  app.genericError = function() {
    alert("Da ist was schiefgelaufen. Frage doch bitte einmal im Chat nach.");
  };


  // ----- methods to show options -----
  function showVendors() {
    $('.vendorselect').html('');
    $('.vendorselect').append(
      createOption(-1, "-- Bitte Hersteller wählen --"));

    for (var vendor in config.vendors) {
      if (config.vendors.hasOwnProperty(vendor)) {
        if (vendor != 'x86') {
          $('.vendorselect').append(
            createOption((vendor), config.vendors[vendor]));
        }
      }
    }
  }

  function showModels() {
    $('.modelselect').html('');
    $('.modelselect').append(
      createOption(-1, "-- Bitte Modell wählen --"));

    for (var r in routers) {
      if (routers.hasOwnProperty(r) &&
          routers[r].vendor == wizard.vendor) {
        $('.modelselect').append(
          createOption(r, routers[r].model));
      }
    }
  }

  function showRevisions(revisions) {
    $('.revisionselect').html('');

    if (!revisions) {
      alert("Keine Revisionen gefunden!");
      return;
    }
    if (!$.isArray(revisions)) {
      app.genericError();
      return;
    }

    $('.revisionselect').append(
      createOption(-1, "-- Bitte Hardwarerevision wählen --"));
    var addedRevs = [];
    for (var i in revisions) {
      var rev = revisions[i];
      if ($.inArray(rev.revision, addedRevs) == -1) {
        addedRevs.push(rev.revision);
        $('.revisionselect').append(
          createOption(rev.revision, rev.revision));
      }
    }

    if (addedRevs.length == 1 && addedRevs[0] == 'alle') {
      $('.revisionselect').val('alle');
      app.setRevision('alle');
    }
  }


  function showTypes() {
    $('.typeselect').html('');
    var addedTypes = [];
    for (var i in routers[wizard.model].revisions) {
      var rev = routers[wizard.model].revisions[i];
      if ($.inArray(rev.type, addedTypes) == -1) {
        addedTypes.push(rev.type);
        var displayType = config.typeNames[rev.type]||rev.type;
        $('.typeselect').append('<input type="radio" id="'+rev.type+'" name="firmwareType" onclick="app.setType(\''+rev.type+'\')"><label for="'+rev.type+'">'+displayType+'</label>');
      }
    }
  }

  function showBranches() {
    $('.branchselect').html('');
    for (var i in routers[wizard.model].revisions) {
      var rev = routers[wizard.model].revisions[i];
      if (rev.revision == wizard.revision && rev.type == wizard.type) {
        $('.branchselect').append('<a href="'+rev.location+'" class="abutton">'+rev.branch+' (' +rev.version+')</a>');
      }
    }
  }


  function showPane(pane) {
    $('.tab-pane').removeClass('active');
    console.log(pane, PANE.MODEL, PANE.IMAGETYPE);
    if (pane >= PANE.MODEL)     $('.tab-pane.step-model').addClass('active');
    if (pane >= PANE.IMAGETYPE) $('.tab-pane.step-type').addClass('active');
    if (pane >= PANE.BRANCH)    $('.tab-pane.step-branch').addClass('active');
  }

  // ----- methods to set options -----
  app.setVendor = function(vendor) {
    if (vendor == -1) {
      $('.modelselect').hide();
      $('.revisionselect').hide();
      showPane(PANE.MODEL);
      return;
    }

    wizard.vendor = vendor;
    $('.choosenvendor').text(config.vendors[vendor]);

    showModels();
    $('.modelselect').show();
    $('.revisionselect').hide();
    showPane(PANE.MODEL);
  };

  app.setModel = function(model) {
    if (model == -1) {
      $('.revisionselect').hide();
      showPane(PANE.MODEL);
      return;
    }

    wizard.model = model;
    $('.choosenmodel').text(routers[model].model);

    $('.revisionselect').show();
    showPane(PANE.MODEL);
    showRevisions(routers[wizard.model].revisions);
  };

  app.setRevision = function(revision) {
    if (revision == -1) {
      showPane(PANE.MODEL);
      return;
    }

    wizard.revision = revision;
    $('.choosenrevision').text(revision);

    showPane(PANE.IMAGETYPE);
    showTypes();
  };

  app.setType = function(type) {
    wizard.type = type;
    $('.choosentype').text(type);

    showPane(PANE.BRANCH);
    showBranches();
  };

  // ----- methods to parse the directory listings
  function isValidFilename(name) {
    return $.inArray(name, IGNORED_ELEMENTS) == -1;
  }

  function parseFilename(dir, name, type, branch) {
    if (!isValidFilename(name)) {
      return;
    }

    if(!name.startsWith(config.gluonPrefix)) {
      console.log('Unexpected file name: '+name+" ["+dir+"]");
      return;
    }

    rname = decodeURIComponent(name).substring(config.gluonPrefix.length);

    var revision = 'alle';
    var revisionposition = rname.search(/v[0-9]+(.[0-9]+)?./);

    rname = rname.replace('-sysupgrade', '');
    rname = rname.replace(/\.bin$/, '');
    rname = rname.replace(/\.img$/, '');
    rname = rname.replace(/\.tar$/, '');
    rname = rname.replace(/\.img.gz$/, '');
    rname = rname.replace(/\.vdi$/, '');
    rname = rname.replace(/\.vmdk$/, '');

    if (revisionposition != -1) {
      revision = rname.substring(revisionposition);
      rname = rname.substring(0, revisionposition-1);
    } else {
      revisionposition = rname.search(/-(a|b|c)[0-9]$/);
      if (revisionposition != -1) {
        revision = rname.substring(revisionposition+1);
        rname = rname.substring(0, revisionposition);
      }
    }

    var version;
    if (rname.search(/[0-9]+.[0-9]+.[0-9]+-[0-9]{8}/) != -1) {
      // version with date in it (e.g. 0.8.0-20160502)
      version = rname.substring(0, rname.search('-')+9);
    } else {
      version = rname.substring(0, rname.search('-'));
    }

    rname = rname.substring(version.length+1);

    var vendor = "unknown";
    for (var v in config.vendors) {
      if (config.vendors.hasOwnProperty(v) && rname.startsWith(v)) {
        vendor = v;
        break;
      }
    }
    if (vendor == "unknown") {
      console.log("Unknown verndor", rname, name);
    }
    var vendorFullname = config.vendors[vendor];

    rname = rname.substring(vendor.length+1);

    var model = '';
    if (vendor == 'ubiquiti') {
      m = rname.split('-');
      for(var i = 0; i < m.length; i++) {
        if (m[i] == 'ls') {
          model += 'LiteStation';
        } else if (m[i].replace(/[0-9]/g, '').length < 3) {
          model += m[i].toUpperCase();
        } else {
          model += m[i].charAt(0).toUpperCase() + m[i].slice(1);
        }
        if (i != m.length) model += ' ';
      }
    } else if (vendor == 'tp-link') {
      model = rname.toUpperCase();
      if (!rname.startsWith('tl')) {
        model = model.replace('-', ' ');
        model = model.replace('ARCHER', 'Archer');
        model = model.replace('CPE', 'CPE ');
      }
      model = model.replace('N-ND', 'N/ND');
    } else if (vendor == 'gl') {
      model = rname.replace('inet-', 'iNet ');
    } else if (vendor == 'd-link') {
      model = rname.replace('-rev', '').toUpperCase();
    } else {
      model = rname.toUpperCase();
    }

    var routerRevision = {
      "revision": revision,
      "branch": branch,
      "type": type,
      "version": version,
      "location": dir+name
    };

    app.currentVersions[branch] = version;

    if(routers.hasOwnProperty(vendor+model)) {
      routers[vendor+model].revisions.push(routerRevision);
    } else {
      routers[vendor+model] = {
        "vendor": vendor,
        "model": model,
        "revisions": [routerRevision]
      };
    }
  }

  function createOption(value, title) {
    var o = document.createElement('option');
    o.value = value;
    o.innerHTML = title;
    return o;
  }

  // update the table and show the vendors for the wizard
  function updateHTML() {
    showVendors();

    $('.currentVersions').text(
      "Stable: "+app.currentVersions.stable+
      " // Beta: "+app.currentVersions.beta+
      " // Experimental: "+app.currentVersions.experimental);

    $(".firmwareTable table tbody").html('');
    var sortedrouters = [];
    for(var key in routers) {
      sortedrouters[sortedrouters.length] = key;
    }
    sortedrouters.sort();

    for (key in sortedrouters) {
      var router = routers[sortedrouters[key]];

      var vendorFullname = config.vendors[router.vendor] || router.vendor;

      var upgradeHTML = {
        "stable": '',
        "beta": '',
        "experimental": ''
      };
      var factoryHTML = {
        "stable": '',
        "beta": '',
        "experimental": ''
      };

      for (var revisionId in router.revisions) {
        var revision = router.revisions[revisionId];
        var html = '[<a href="'+revision.location+'" title="'+revision.version+'">'+revision.revision+'</a>] ';

        if (revision.type == "sysupgrade") {
          upgradeHTML[revision.branch] += html;
        } else if (revision.type == "factory") {
          factoryHTML[revision.branch] += html;
        } else {
          app.genericError();
          console.log(revision);
          console.log(revision.type);
        }
      }

      var showStable = upgradeHTML.stable !== '' || factoryHTML.stable !== '';
      var showBeta   = upgradeHTML.beta !== '' || factoryHTML.beta !== '';
      var showExperimental = upgradeHTML.experimental !== '' ||
                             factoryHTML.experimental !== '';

      $(".firmwareTable table tbody").append(
        '<tr><td>'+vendorFullname+'</td><td>'+router.model+'</td><td>'+
        (showStable?'stable: '+(factoryHTML.stable||'-')+'<br>':'')+
        (showBeta?'beta: '+(factoryHTML.beta||'-')+'<br>':'')+
        (showExperimental?'experimental: '+(factoryHTML.experimental||'-'):'')+
        '</td>'+'<td>'+
        (showStable?'stable: '+(upgradeHTML.stable||'-')+'<br>':'')+
        (showBeta?'beta: '+(upgradeHTML.beta||'-')+'<br>':'')+
        (showExperimental?'experimental: '+(upgradeHTML.experimental||'-'):'')+
        '</td></tr>'
      );
    }
  }

  // parse the contents of the given directory
  function loadDirectory(branch, type, dir) {
    // retrieve the contents of the directory
    $.get(dir, function(data) {
      html = $.parseHTML(data);

      // parse filenames
      $(html).find("a").each(function(i, element){
        if (isValidFilename(element.getAttribute('href'))) {
          parseFilename(dir, element.getAttribute('href'), type, branch);
        }
      });

      updateHTML();
    });
  }

  loadDirectory('stable', 'factory',
                config.imageBasePath+'stable/factory/');
  loadDirectory('stable', 'sysupgrade',
                config.imageBasePath+'stable/sysupgrade/');
  loadDirectory('beta', 'factory',
                config.imageBasePath+'beta/factory/');
  loadDirectory('beta', 'sysupgrade',
                config.imageBasePath+'beta/sysupgrade/');
  loadDirectory('experimental', 'factory',
                config.imageBasePath+'experimental/factory/');
  loadDirectory('experimental', 'sysupgrade',
                config.imageBasePath+'experimental/sysupgrade/');

  app.showFirmwareTable = function() {
    $('.firmwareTable').show();
    $('.firmwareTableLink').hide();
  };

  if (location.hash == "#firmwareTable") {
    app.showFirmwareTable();
  }

  return app;
}();
