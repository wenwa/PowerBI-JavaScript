import * as service from '../src/service';
import * as embed from '../src/embed';
import * as report from '../src/report';
import * as dashboard from '../src/dashboard';
import * as page from '../src/page';
import * as visual from '../src/visual';
import * as Wpmp from 'window-post-message-proxy';
import * as Hpm from 'http-post-message';
import * as Router from 'powerbi-router';
import * as models from 'powerbi-models';
import { spyApp, setupEmbedMockApp } from './utility/mockEmbed';
import * as factories from '../src/factories';
import { spyWpmp } from './utility/mockWpmp';
import { spyHpm } from './utility/mockHpm';
import { spyRouter } from './utility/mockRouter';
import * as util from '../src/util';

declare global {
  interface Window {
    __karma__: any;
  }
}

let logMessages = (window.__karma__.config.args[0] === 'logMessages');

describe('service', function () {
  let powerbi: service.Service;
  let $element: JQuery;

  beforeAll(function () {
    powerbi = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory);
    powerbi.accessToken = 'ABC123';
    $element = $('<div id="powerbi-fixture"></div>').appendTo(document.body);
  });

  afterAll(function () {
    $element.remove();
    powerbi.wpmp.stop();
  });

  afterEach(function () {
    $element.empty();
  });

  it('is defined', function () {
    expect(powerbi).toBeDefined();
  });

  describe('init', function () {
    it('embeds all components found in the DOM', function () {
      // Arrange
      const elements = [
        '<div powerbi-embed-url="https://embedded.powerbi.com/appTokenReportEmbed?reportId=ABC123" powerbi-type="report"></div>',
        '<div powerbi-embed-url="https://embedded.powerbi.com/appTokenReportEmbed?reportId=XYZ456" powerbi-type="report"></div>',
      ];

      elements.forEach(element => {
        $(element).appendTo('#powerbi-fixture');
      });

      // Act
      powerbi.init();

      // Assert
      // If embed element has iframe inside it, assume embed action occurred
      const iframes = document.querySelectorAll('[powerbi-embed-url] iframe');
      expect(iframes.length).toEqual(2);
    });
  });

  describe('get', function () {
    it('if attempting to get a powerbi component on an element which was not embedded, throw an error', function () {
      // Arrange
      const $component = $('<div></div>');

      // Act
      const attemptGet = () => {
        powerbi.get($component[0]);
      };

      // Assert
      expect(attemptGet).toThrowError(Error);
    });

    it('calling get on element with embeded report component returns the instance', function () {
      // Arrange
      const $element = $('<div powerbi-type="report" powerbi-embed-url="https://app.powerbi.com/reportEmbed?reportId=ABC123"></div>')
        .appendTo('#powerbi-fixture');

      const componentInstance = powerbi.embed($element[0]);

      // Act
      const componentInstance2 = powerbi.get($element[0]);

      // Assert
      expect(componentInstance).toEqual(componentInstance2);
    })

    it('calling get on element with embeded dashboard component returns the instance', function () {
      // Arrange
      const $element = $('<div powerbi-type="dashboard" powerbi-embed-url="https://app.powerbi.com/dashboardEmbed?dashboardId=ABC123"></div>')
        .appendTo('#powerbi-fixture');

      const componentInstance = powerbi.embed($element[0]);

      // Act
      const componentInstance2 = powerbi.get($element[0]);

      // Assert
      expect(componentInstance).toEqual(componentInstance2);
    })
  });

  describe('embed', function () {
    it('if attempting to embed without specifying a type, throw error', function () {
      // Arrange
      const component = $('<div></div>')
        .appendTo('#powerbi-fixture');

      // Act
      const attemptEmbed = () => {
        powerbi.embed(component[0]);
      };

      // Assert
      expect(attemptEmbed).toThrowError(Error);
    });

    it('if attempting to embed with an unknown type, throw error', function () {
      // Arrange
      const component = $('<div powerbi-type="unknownType"></div>')
        .appendTo('#powerbi-fixture');

      // Act
      const attemptEmbed = () => {
        powerbi.embed(component[0]);
      };

      // Assert
      expect(attemptEmbed).toThrowError(Error);
    });

    it('if attempting to embed without specifying an embed url, throw error', function () {
      // Arrange
      const component = $('<div></div>')
        .appendTo('#powerbi-fixture');

      // Act
      const attemptEmbed = () => {
        powerbi.embed(component[0], { type: "report", embedUrl: null, accessToken: null, id: null });
      };

      // Assert
      expect(attemptEmbed).toThrowError(Error);
    });

    it('if attempting to embed without specifying an access token, throw error', function () {
      // Arrange
      const component = $('<div></div>')
        .appendTo('#powerbi-fixture');

      const originalToken = powerbi.accessToken;
      powerbi.accessToken = undefined;

      // Act
      const attemptEmbed = () => {
        powerbi.embed(component[0], { type: "report", embedUrl: null, accessToken: null, id: null });
      };

      // Assert
      expect(attemptEmbed).toThrowError(Error);

      // Cleanup
      powerbi.accessToken = originalToken;
    });

    it('if attempting to embed without specifying an id, throw error', function () {
      // Arrange
      const embedUrl = `https://embedded.powerbi.com/appTokenReportEmbed`;
      const $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report"></div>`)
        .appendTo('#powerbi-fixture');

      // Act
      const attemptToEmbed = () => {
        powerbi.embed($reportContainer[0]);
      };

      // Assert
      expect(attemptToEmbed).toThrowError();
    });

    it('should get uqiqueId from config first', function () {
      // Arrange
      const testUniqueId = 'fakeUniqueId';
      const embedUrl = `https://embedded.powerbi.com/appTokenReportEmbed`;
      const $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report" powerbi-report-id="abc123" powerbi-name="differentUniqueId"></div>`)
        .appendTo('#powerbi-fixture');

      // Act
      const report = powerbi.embed($reportContainer[0], { uniqueId: testUniqueId });

      // Assert
      expect(report.config.uniqueId).toEqual(testUniqueId);
    });

    it('should get uqiqueId from name attribute if uniqueId is not specified in config', function () {
      // Arrange
      const testUniqueId = 'fakeUniqueId';
      const embedUrl = `https://embedded.powerbi.com/appTokenReportEmbed`;
      const $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report" powerbi-report-id="abc123" powerbi-name="${testUniqueId}"></div>`)
        .appendTo('#powerbi-fixture');

      // Act
      const report = powerbi.embed($reportContainer[0]);

      // Assert
      expect(report.config.uniqueId).toEqual(testUniqueId);
    });

    it('should generate uqiqueId if uniqueId is not specified in config or attribute', function () {
      // Arrange
      const testUniqueId = 'fakeUniqueId';
      const embedUrl = `https://embedded.powerbi.com/appTokenReportEmbed`;
      const $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report" powerbi-report-id="abc123"></div>`)
        .appendTo('#powerbi-fixture');

      // Act
      const report = powerbi.embed($reportContainer[0]);

      // Assert
      expect(report.config.uniqueId).toEqual(jasmine.any(String));
    });

    it('should get filterPaneEnabled setting from attribute from config and then attribute', function () {
      // Arrange
      const testUniqueId = 'fakeUniqueId';
      const embedUrl = `https://embedded.powerbi.com/appTokenReportEmbed`;
      const $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report" powerbi-report-id="abc123" powerbi-settings-filter-pane-enabled="false"></div>`)
        .appendTo('#powerbi-fixture');

      // Act
      const report = powerbi.embed($reportContainer[0]);

      // Assert
      expect(report.config.settings.filterPaneEnabled).toEqual(false);
    });

    it('should get navContentPaneEnabled setting from attribute from config and then attribute', function () {
      // Arrange
      const testUniqueId = 'fakeUniqueId';
      const embedUrl = `https://embedded.powerbi.com/appTokenReportEmbed`;
      const $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report" powerbi-report-id="abc123" powerbi-settings-nav-content-pane-enabled="false"></div>`)
        .appendTo('#powerbi-fixture');

      // Act
      const report = powerbi.embed($reportContainer[0]);

      // Assert
      expect(report.config.settings.navContentPaneEnabled).toEqual(false);
    });

    it('if component is already embedded in element re-use the existing component by calling load with the new information', function () {
      // Arrange
      const $element = $('<div powerbi-embed-url="https://app.powerbi.com/reportEmbed?reportId=ABC123" powerbi-type="report"></div>')
        .appendTo('#powerbi-fixture');

      const component = powerbi.embed($element[0]);
      spyOn(component, "load");

      const testConfiguration = {
        accessToken: undefined,
        embedUrl: 'fakeUrl',
        id: 'report2'
      };

      // Act
      const component2 = powerbi.embed($element[0], testConfiguration);

      // Assert
      expect(component.load).toHaveBeenCalledWith(testConfiguration);
      expect(component2).toBe(component);
    });

    it('if report embed component was not previously created, creates an instance and return it', function () {
      // Arrange
      var component = $('<div powerbi-embed-url="https://app.powerbi.com/reportEmbed?reportId=ABC123" powerbi-type="report"></div>')
        .appendTo('#powerbi-fixture');

      // Act
      var report = powerbi.embed(component[0]);

      // Assert
      expect(report).toBeDefined();
    });
    
    it('if dashboard embed component was not previously created, creates an instance and return it', function () {
      // Arrange
      var component = $('<div powerbi-embed-url="https://app.powerbi.com/dashboardEmbed?dashboardId=ABC123" powerbi-type="dashboard"></div>')
        .appendTo('#powerbi-fixture');

      // Act
      var dashboard = powerbi.embed(component[0]);

      // Assert
      expect(dashboard).toBeDefined();
    });

    it("looks for a token first from attribute 'powerbi-access-token'", function () {
      // Arrange
      var embedUrl = 'https://embedded.powerbi.com/appTokenReportEmbed?reportId=ABC123';
      var testToken = "fakeToken1";
      var $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report" powerbi-access-token="${testToken}"></div>`)
        .appendTo('#powerbi-fixture');

      // Act
      powerbi.embed($reportContainer[0]);

      // Assert
      var report = powerbi.get($reportContainer[0]);
      var accessToken = report.config.accessToken;

      expect(accessToken).toEqual(testToken);
    });

    it("if token is not found by attribute 'powerbi-access-token', fallback to using global", function () {
      // Arrange
      var embedUrl = 'https://embedded.powerbi.com/appTokenReportEmbed?reportId=ABC123';
      var testToken = "fakeToken1";
      var $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report"></div>`)
        .appendTo('#powerbi-fixture');

      var originalToken = powerbi.accessToken;
      powerbi.accessToken = testToken;

      // Act
      powerbi.embed($reportContainer[0]);

      // Assert
      var report = powerbi.get($reportContainer[0]);
      var accessToken = report.config.accessToken;

      expect(accessToken).toEqual(testToken);

      // Cleanup
      powerbi.accessToken = originalToken;
    });

    describe('reports', function () {
      it('creates report iframe from embedUrl', function () {
        // Arrange
        var embedUrl = 'https://embedded.powerbi.com/appTokenReportEmbed?reportId=ABC123';
        var $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report"></div>`)
          .appendTo('#powerbi-fixture');

        // Act
        let report = powerbi.embed($reportContainer[0]);

        // Assert
        var iframe = $reportContainer.find('iframe');
        expect(iframe.length).toEqual(1);
        expect(iframe.attr('src')).toEqual(embedUrl);
      });

      describe('findIdFromEmbedUrl', function () {
        it('should return value of reportId query parameter in embedUrl', function () {
          // Arrange
          const testReportId = "ABC123";
          const testEmbedUrl = `http://embedded.powerbi.com/appTokenReportEmbed?reportId=${testReportId}`;

          // Act
          const reportId = report.Report.findIdFromEmbedUrl(testEmbedUrl);

          // Assert
          expect(reportId).toEqual(testReportId);
        });

        it('should return undefinded if the query parameter is not in the url', function () {
          // Arrange
          const testEmbedUrl = `http://embedded.powerbi.com/appTokenReportEmbed`;

          // Act
          const reportId = report.Report.findIdFromEmbedUrl(testEmbedUrl);

          // Assert
          expect(reportId).toBeUndefined();
        });
      });

      it('should get report id from configuration first', function () {
        // Arrange
        const testReportId = "ABC123";
        const embedUrl = `https://embedded.powerbi.com/appTokenReportEmbed?reportId=DIFFERENTID`;
        const $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report"></div>`)
          .appendTo('#powerbi-fixture');

        // Act
        const report = powerbi.embed($reportContainer[0], { id: testReportId });

        // Assert
        expect(report.config.id).toEqual(testReportId);
      });

      it('should fallback to using id from attribute if not supplied in embed/load configuration', function () {
        // Arrange
        const testReportId = "ABC123";
        const embedUrl = `https://embedded.powerbi.com/appTokenReportEmbed?reportId=DIFFERENTID`;
        const $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report" powerbi-report-id="${testReportId}"></div>`)
          .appendTo('#powerbi-fixture');

        // Act
        const report = powerbi.embed($reportContainer[0]);

        // Assert
        expect(report.config.id).toEqual(testReportId);
      });

      it('should fallback to using id from embedUrl if not supplied in embed/load configuration or attribute', function () {
        // Arrange
        const testReportId = "ABC123";
        const embedUrl = `https://embedded.powerbi.com/appTokenReportEmbed?reportId=${testReportId}`;
        const $reportContainer = $(`<div powerbi-embed-url="${embedUrl}" powerbi-type="report" powerbi-report-id></div>`)
          .appendTo('#powerbi-fixture');

        // Act
        const report = powerbi.embed($reportContainer[0]);

        // Assert
        expect(report.config.id).toEqual(testReportId);
      });
    });

    xdescribe('tiles', function () {
      it('creates tile iframe from embedUrl', function () {
        // Arrange
        var embedUrl = 'https://app.powerbi.com/embed?dashboardId=D1&tileId=T1';
        var $tileContainer = $('<div powerbi-embed-url="' + embedUrl + '" powerbi-type="tile"></div>')
          .appendTo('#powerbi-fixture');

        // Act
        let tile = powerbi.embed($tileContainer[0]);

        // Assert
        var iframe = $tileContainer.find('iframe');
        expect(iframe.length).toEqual(1);
        expect(iframe.attr('src')).toEqual(embedUrl);
      });
    });
  });

  describe('reset', function () {
    it('deletes the powerBiEmbed property on the element', function () {
      // Arrange
      const $element = $('<div></div>');
      powerbi.embed($element.get(0), {
        type: 'report',
        embedUrl: 'fakeUrl',
        id: 'fakeId',
        accessToken: 'fakeToken'
      });

      // Act
      expect((<service.IPowerBiElement>$element.get(0)).powerBiEmbed).toBeDefined();
      powerbi.reset($element.get(0));

      // Assert
      expect((<service.IPowerBiElement>$element.get(0)).powerBiEmbed).toBeUndefined();
    });

    it('clears the innerHTML of the element', function () {
      // Arrange
      const $element = $('<div></div>');
      powerbi.embed($element.get(0), {
        type: 'report',
        embedUrl: 'fakeUrl',
        id: 'fakeReportId',
        accessToken: 'fakeToken'
      });

      // Act
      var iframe = $element.find('iframe');
      expect(iframe.length).toEqual(1);
      powerbi.reset($element.get(0));

      // Assert
      expect($element.html()).toEqual('');
    });

    it('removes the powerbi instance from the list of embeds', function () {
      // Arrange
      const $element = $('<div></div>');
      const testEmbedConfig = {
        type: 'report',
        embedUrl: 'fakeUrl',
        id: 'fakeReportId',
        accessToken: 'fakeToken',
        uniqueId: 'fakeUniqeId'
      };
      powerbi.embed($element.get(0), testEmbedConfig);

      // Act
      const report = powerbi.find(testEmbedConfig.uniqueId);
      expect(report).toBeDefined();

      powerbi.reset($element.get(0));

      // Assert
      const report2 = powerbi.find(testEmbedConfig.uniqueId);
      expect(report2).toBeUndefined();
    });
  });
});

describe('embed', function () {
  let powerbi: service.Service;
  let $element: JQuery;
  let $container: JQuery;
  let $iframe: JQuery;

  beforeAll(function () {
    powerbi = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory);
    powerbi.accessToken = 'ABC123';
    $element = $('<div id="powerbi-fixture"></div>').appendTo(document.body);
  });

  beforeEach(function () {
    $container = $('<div powerbi-embed-url="https://app.powerbi.com/reportEmbed?reportId=ABC123" powerbi-type="report"></div>')
      .appendTo('#powerbi-fixture');

    powerbi.embed($container[0]);
    $iframe = $container.find('iframe');
  });

  afterEach(function () {
    $element.empty();
  });

  afterAll(function () {
    $element.remove();
    powerbi.wpmp.stop();
  });

  describe('iframe', function () {
    it('has a src', function () {
      expect($iframe.attr('src').length).toBeGreaterThan(0);
    });

    it('disables scrollbars by default', function () {
      expect($iframe.attr('scrolling')).toEqual('no');
    });

    it('sets width/height to 100%', function () {
      expect($iframe[0].style.width).toEqual('100%');
      expect($iframe[0].style.height).toEqual('100%');
    });
  });

  describe('fullscreen', function () {
    it('sets the iframe as the fullscreen element', function () {
      var report = powerbi.get($container[0]);
      report.fullscreen();

      expect(document.webkitFullscreenElement === $iframe[0]);
    });
  });

  describe('exitFullscreen', function () {
    it('clears the iframe fullscreen element', function () {
      var report = powerbi.get($container[0]);
      report.fullscreen();
      report.exitFullscreen();

      expect(document.webkitFullscreenElement !== $iframe[0]);
    });
  });
});

describe('Protocol', function () {
  let hpm: Hpm.HttpPostMessage;
  let wpmp: Wpmp.WindowPostMessageProxy;
  let iframe: HTMLIFrameElement;
  let iframeHpm: Hpm.HttpPostMessage;
  let iframeLoaded: Promise<void>;

  let handler: Wpmp.IMessageHandler;
  let spyHandler: {
    test: jasmine.Spy,
    handle: jasmine.Spy
  };

  beforeAll(function () {
    const iframeSrc = "base/test/utility/noop.html";
    const $iframe = $(`<iframe src="${iframeSrc}"></iframe>`).appendTo(document.body);
    iframe = <HTMLIFrameElement>$iframe.get(0);

    // Register Iframe side
    iframeHpm = setupEmbedMockApp(iframe.contentWindow, window, logMessages, 'ProtocolMockAppWpmp');

    // Register SDK side WPMP
    wpmp = factories.wpmpFactory('HostProxyDefaultNoHandlers', logMessages, iframe.contentWindow);
    hpm = factories.hpmFactory(wpmp, iframe.contentWindow, 'testVersion');
    const router = factories.routerFactory(wpmp);

    router.post('/reports/:uniqueId/events/:eventName', (req, res) => {
      handler.handle(req);
      res.send(202);
    });

    router.post('/reports/:uniqueId/pages/:pageName/events/:eventName', (req, res) => {
      handler.handle(req);
      res.send(202);
    });

    router.post('/reports/:uniqueId/pages/:pageName/visuals/:visualId/events/:eventName', (req, res) => {
      handler.handle(req);
      res.send(202);
    });

    handler = {
      test: jasmine.createSpy("testSpy").and.returnValue(true),
      handle: jasmine.createSpy("handleSpy").and.callFake(function (message: any) {
        message.handled = true;
        return message;
      })
    };

    spyHandler = <any>handler;
    // wpmp.addHandler(handler);

    iframeLoaded = new Promise<void>((resolve, reject) => {
      iframe.addEventListener('load', () => {
        resolve(null);
      });
    });
  });

  afterAll(function () {
    wpmp.stop();
  });

  beforeEach(() => {
    // empty
  });

  afterEach(function () {
    spyHandler.test.calls.reset();
    spyHandler.handle.calls.reset();
  });

  describe('HPM-to-MockApp', function () {
    describe('notfound', function () {
      it('GET request to uknown url returns 404 Not Found', function (done) {
        iframeLoaded
          .then(() => {
            hpm.get<any>('route/that/does/not/exist')
              .catch(response => {
                expect(response.statusCode).toEqual(404);
                done();
              });
          });
      });

      it('POST request to uknown url returns 404 Not Found', function (done) {
        iframeLoaded
          .then(() => {
            hpm.post<any>('route/that/does/not/exist', null)
              .catch(response => {
                expect(response.statusCode).toEqual(404);
                done();
              });
          });
      });

      it('PUT request to uknown url returns 404 Not Found', function (done) {
        iframeLoaded
          .then(() => {
            hpm.put<any>('route/that/does/not/exist', null)
              .catch(response => {
                expect(response.statusCode).toEqual(404);
                done();
              });
          });
      });

      it('PATCH request to uknown url returns 404 Not Found', function (done) {
        iframeLoaded
          .then(() => {
            hpm.patch<any>('route/that/does/not/exist', null)
              .catch(response => {
                expect(response.statusCode).toEqual(404);
                done();
              });
          });
      });

      it('DELETE request to uknown url returns 404 Not Found', function (done) {
        iframeLoaded
          .then(() => {
            hpm.delete<any>('route/that/does/not/exist')
              .catch(response => {
                expect(response.statusCode).toEqual(404);
                done();
              });
          });
      });
    });

    describe('load', function () {
      describe('report', function () {
        it('POST /report/load returns 400 if the request is invalid', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          load: {
            reportId: "fakeId",
            accessToken: "fakeToken",
            options: {
            }
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validateLoad.and.returnValue(Promise.reject(null));

            // Act
            hpm.post<models.IError>('/report/load', testData.load, { uid: testData.uniqueId })
              .then(() => {
                expect(false).toBe(true);
                spyApp.validateLoad.calls.reset();
                done();
              })
              .catch(response => {
                // Assert
                expect(spyApp.validateLoad).toHaveBeenCalledWith(testData.load);
                expect(spyApp.load).not.toHaveBeenCalledWith(testData.load);
                expect(response.statusCode).toEqual(400);
                // Cleanup
                spyApp.validateLoad.calls.reset();
                done();
              });
          });
      });
      
        it('POST /report/load returns 202 if the request is valid', function (done) {
        // Arrange
        const testData = {
          load: {
            reportId: "fakeId",
            accessToken: "fakeToken",
            options: {
            }
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validateLoad.and.returnValue(Promise.resolve(null));
            // Act
            hpm.post<void>('/report/load', testData.load)
              .then(response => {
                // Assert
                expect(spyApp.validateLoad).toHaveBeenCalledWith(testData.load);
                expect(spyApp.load).toHaveBeenCalledWith(testData.load);
                expect(response.statusCode).toEqual(202);
                // Cleanup
                spyApp.validateLoad.calls.reset();
                spyApp.load.calls.reset();
                done();
              });
          });
      });
      
        it('POST /report/load causes POST /reports/:uniqueId/events/loaded', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          load: {
            reportId: "fakeId",
            accessToken: "fakeToken",
            options: {
              navContentPaneEnabled: false
            }
          },
        };
        const testExpectedEvent = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/loaded`,
          body: {
            initiator: 'sdk'
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.load.and.returnValue(Promise.resolve(testData.load));

            // Act
            hpm.post<void>('/report/load', testData.load, { uid: testData.uniqueId })
              .then(response => {
                setTimeout(() => {
                  // Assert
                  expect(spyApp.validateLoad).toHaveBeenCalledWith(testData.load);
                  expect(spyApp.load).toHaveBeenCalledWith(testData.load);
                  expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedEvent));
                  // Cleanup
                  spyApp.validateLoad.calls.reset();
                  spyApp.load.calls.reset();
                  done();
                });
              });
          });
      });

        it('POST /report/load causes POST /reports/:uniqueId/events/error', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          load: {
            reportId: "fakeId",
            accessToken: "fakeToken",
            options: {
              navContentPaneEnabled: false
            }
          },
          error: {
            message: "error message"
          }
        };
        const testExpectedEvent = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/error`,
          body: testData.error
        };

        iframeLoaded
          .then(() => {
            spyApp.load.and.returnValue(Promise.reject(testData.error));

            // Act
            hpm.post<void>('/report/load', testData.load, { uid: testData.uniqueId })
              .then(response => {
                setTimeout(() => {
                  // Assert
                  expect(spyApp.validateLoad).toHaveBeenCalledWith(testData.load);
                  expect(spyApp.load).toHaveBeenCalledWith(testData.load);
                  expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedEvent));
                  // Cleanup
                  spyApp.validateLoad.calls.reset();
                  spyApp.load.calls.reset();
                  done();
                });
              });
          });
      });
      });
      
      describe('dashboard', function () {
        it('POST /dashboard/load returns 202 if the request is valid', function (done) {
          
        // Arrange
        const testData = {
          load: {
            dashboardId: "fakeId",
            accessToken: "fakeToken",
            options: {
            }
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validateLoad.and.returnValue(Promise.resolve(null));
            // Act
            hpm.post<void>('/dashboard/load', testData.load)
              .then(response => {
                // Assert
                expect(spyApp.validateLoad).toHaveBeenCalledWith(testData.load);
                expect(spyApp.load).toHaveBeenCalledWith(testData.load);
                expect(response.statusCode).toEqual(202);
                // Cleanup
                spyApp.validateLoad.calls.reset();
                spyApp.load.calls.reset();
                done();
              });
          });
      });
      
        it('POST /dashboard/load returns 400 if the request is invalid', function (done) {
            
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          load: {
            dashboardId: "fakeId",
            accessToken: "fakeToken",
            options: {
            }
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validateLoad.and.returnValue(Promise.reject(null));

            // Act
            hpm.post<models.IError>('/dashboard/load', testData.load, { uid: testData.uniqueId })
              .then(() => {
                expect(false).toBe(true);
                spyApp.validateLoad.calls.reset();
                done();
              })
              .catch(response => {
                // Assert
                expect(spyApp.validateLoad).toHaveBeenCalledWith(testData.load);
                expect(spyApp.load).not.toHaveBeenCalledWith(testData.load);
                expect(response.statusCode).toEqual(400);
                // Cleanup
                spyApp.validateLoad.calls.reset();
                done();
              });
          });
      });
      });
    });

    describe('pages', function () {

      it('GET /report/pages returns 200 with body as array of pages', function (done) {
        // Arrange
        const testData = {
          expectedPages: [
            {
              name: "a"
            },
            {
              name: "b"
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.getPages.and.returnValue(Promise.resolve(testData.expectedPages));
            // Act
            hpm.get<models.IPage[]>('/report/pages')
              .then(response => {
                // Assert
                expect(spyApp.getPages).toHaveBeenCalled();
                const pages = response.body;
                expect(pages).toEqual(testData.expectedPages);
                // Cleanup
                spyApp.getPages.calls.reset();
                done();
              });
          });
      });

      it('GET /report/pages returns 500 with body as error', function (done) {
        // Arrange
        const testData = {
          expectedError: {
            message: "could not query pages"
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.getPages.and.returnValue(Promise.reject(testData.expectedError));
            // Act
            hpm.get<models.IPage[]>('/report/pages')
              .catch(response => {
                // Assert
                expect(spyApp.getPages).toHaveBeenCalled();
                const error = response.body;
                expect(error).toEqual(testData.expectedError);
                // Cleanup
                spyApp.getPages.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/pages/active returns 400 if request is invalid', function (done) {
        // Arrange
        const testData = {
          page: {
            name: "fakeName"
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.reject(null));
            // Act
            hpm.put<void>('/report/pages/active', testData.page)
              .catch(response => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalledWith(testData.page);
                expect(spyApp.setPage).not.toHaveBeenCalled();
                expect(response.statusCode).toEqual(400);
                // Cleanup
                spyApp.validatePage.calls.reset();
                spyApp.setPage.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/pages/active returns 202 if request is valid', function (done) {
        // Arrange
        const testData = {
          page: {
            name: "fakeName"
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.resolve(null));

            // Act
            hpm.put<void>('/report/pages/active', testData.page)
              .then(response => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalledWith(testData.page);
                expect(spyApp.setPage).toHaveBeenCalledWith(testData.page);
                expect(response.statusCode).toEqual(202);
                // Cleanup
                spyApp.validatePage.calls.reset();
                spyApp.setPage.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/pages/active causes POST /reports/:uniqueId/events/pageChanged', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          page: {
            name: "fakeName"
          }
        };
        const expectedEvent = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/pageChanged`,
          body: jasmine.objectContaining({
            initiator: 'sdk'
          })
        };

        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.resolve(null));

            // Act
            hpm.put<void>('/report/pages/active', testData.page, { uid: testData.uniqueId })
              .then(response => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalledWith(testData.page);
                expect(spyApp.setPage).toHaveBeenCalledWith(testData.page);
                expect(response.statusCode).toEqual(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(expectedEvent));
                // Cleanup
                spyApp.validateLoad.calls.reset();
                spyApp.setPage.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/pages/active causes POST /reports/:uniqueId/events/error', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          page: {
            name: "fakeName"
          },
          error: {
            message: "error"
          }
        };
        const expectedEvent = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/error`,
          body: testData.error
        };

        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.resolve(null));
            spyApp.setPage.and.returnValue(Promise.reject(testData.error));

            // Act
            hpm.put<void>('/report/pages/active', testData.page, { uid: testData.uniqueId })
              .then(response => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalledWith(testData.page);
                expect(spyApp.setPage).toHaveBeenCalledWith(testData.page);
                expect(response.statusCode).toEqual(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(expectedEvent));
                // Cleanup
                spyApp.validateLoad.calls.reset();
                spyApp.setPage.calls.reset();
                done();
              });
          });
      });
    });

    describe('print', function () {
      it('POST /report/print returns 202 if the request is valid', function (done) {
        // Arrange
        iframeLoaded
          .then(() => {
            spyApp.print.and.returnValue(Promise.resolve(null));
            // Act
            hpm.post<void>('/report/print', null)
              .then(response => {
                // Assert
                expect(spyApp.print).toHaveBeenCalled();
                expect(response.statusCode).toEqual(202);
                // Cleanup
                spyApp.print.calls.reset();
                done();
              });
          });
      });
    });

    describe('refresh', function () {
      it('POST /report/refresh returns 202 if the request is valid', function (done) {
        // Arrange
        iframeLoaded
          .then(() => {
            spyApp.refreshData.and.returnValue(Promise.resolve(null));
            // Act
            hpm.post<void>('/report/refresh', null)
              .then(response => {
                // Assert
                expect(spyApp.refreshData).toHaveBeenCalled();
                expect(response.statusCode).toEqual(202);
                // Cleanup
                spyApp.refreshData.calls.reset();
                done();
              });
          });
      });
    });

    describe('filters (report level)', function () {
      it('GET /report/filters returns 200 with body as array of filters', function (done) {
        // Arrange
        const testData = {
          filters: [
            {
              name: "fakeFilter1"
            },
            {
              name: "fakeFilter2"
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.getFilters.and.returnValue(Promise.resolve(testData.filters));

            // Act
            hpm.get<models.IFilter[]>('/report/filters')
              .then(response => {
                // Assert
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(response.statusCode).toEqual(200);
                expect(response.body).toEqual(testData.filters);
                // Cleanup
                spyApp.getFilters.calls.reset();
                done();
              });
          });
      });

      it('GET /report/filters returns 500 with body as error', function (done) {
        // Arrange
        const testData = {
          error: {
            message: "internal error"
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.getFilters.and.returnValue(Promise.reject(testData.error));

            // Act
            hpm.get<models.IFilter[]>('/report/filters')
              .catch(response => {
                // Assert
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(response.statusCode).toEqual(500);
                expect(response.body).toEqual(testData.error);
                // Cleanup
                spyApp.getFilters.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/filters returns 400 if request is invalid', function (done) {
        // Arrange
        const testData = {
          filters: [
            {
              name: "fakeFilter"
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateFilter.and.returnValue(Promise.reject(null));

            // Act
            hpm.put<models.IError>('/report/filters', testData.filters)
              .catch(response => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).not.toHaveBeenCalled();
                expect(response.statusCode).toEqual(400);
                // Cleanup
                spyApp.validateFilter.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/filters returns 202 if request is valid', function (done) {
        // Arrange
        const testData = {
          filters: [
            {
              name: "fakeFilter"
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateFilter.and.returnValue(Promise.resolve(null));

            // Act
            hpm.put<void>('/report/filters', testData.filters)
              .then(response => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).toHaveBeenCalledWith(testData.filters);
                expect(response.statusCode).toEqual(202);
                // Cleanup
                spyApp.validateFilter.calls.reset();
                spyApp.setFilters.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/filters will cause POST /reports/:uniqueId/events/filtersApplied', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          filters: [
            {
              name: "fakeFilter"
            }
          ]
        };
        const testExpectedEvent = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/filtersApplied`
        };

        iframeLoaded
          .then(() => {
            spyApp.validateFilter.and.returnValue(Promise.resolve(null));

            // Act
            hpm.put<void>('/report/filters', testData.filters, { uid: testData.uniqueId })
              .then(response => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).toHaveBeenCalledWith(testData.filters);
                expect(response.statusCode).toEqual(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedEvent));
                // Cleanup
                spyApp.validateFilter.calls.reset();
                spyApp.setFilters.calls.reset();
                done();
              });
          });
      });
    });

    describe('filters (page level)', function () {
      it('GET /report/pages/xyz/filters returns 200 with body as array of filters', function (done) {
        // Arrange
        const testData = {
          filters: [
            {
              name: "fakeFilter1"
            },
            {
              name: "fakeFilter2"
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.getFilters.and.returnValue(Promise.resolve(testData.filters));

            // Act
            hpm.get<models.IFilter[]>('/report/pages/xyz/filters')
              .then(response => {
                // Assert
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(response.statusCode).toEqual(200);
                expect(response.body).toEqual(testData.filters);
                // Cleanup
                spyApp.getFilters.calls.reset();
                done();
              });
          });
      });

      it('GET /report/pages/xyz/filters returns 500 with body as error', function (done) {
        // Arrange
        const testData = {
          error: {
            message: "internal error"
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.getFilters.and.returnValue(Promise.reject(testData.error));

            // Act
            hpm.get<models.IFilter[]>('/report/pages/xyz/filters')
              .catch(response => {
                // Assert
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(response.statusCode).toEqual(500);
                expect(response.body).toEqual(testData.error);
                // Cleanup
                spyApp.getFilters.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/pages/xyz/filters returns 400 if request is invalid', function (done) {
        // Arrange
        const testData = {
          filters: [
            {
              name: "fakeFilter"
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateFilter.and.returnValue(Promise.reject(null));

            // Act
            hpm.put<models.IError>('/report/pages/xyz/filters', testData.filters)
              .catch(response => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).not.toHaveBeenCalled();
                expect(response.statusCode).toEqual(400);
                // Cleanup
                spyApp.validateFilter.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/pages/xyz/filters returns 202 if request is valid', function (done) {
        // Arrange
        const testData = {
          filters: [
            {
              name: "fakeFilter"
            }
          ],
        };

        iframeLoaded
          .then(() => {
            spyApp.validateFilter.and.returnValue(Promise.resolve(null));

            // Act
            hpm.put<void>('/report/pages/xyz/filters', testData.filters)
              .then(response => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).toHaveBeenCalledWith(testData.filters);
                expect(response.statusCode).toEqual(202);
                // Cleanup
                spyApp.validateFilter.calls.reset();
                spyApp.setFilters.calls.reset();
                done();
              });
          });
      });

      it('PUT /report/pages/xyz/filters will cause POST /reports/:uniqueId/pages/xyz/events/filtersApplied', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          filters: [
            {
              name: "fakeFilter"
            }
          ]
        };
        const testExpectedEvent = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/pages/xyz/events/filtersApplied`
        };

        iframeLoaded
          .then(() => {
            spyHandler.handle.calls.reset();
            spyApp.validateFilter.and.returnValue(Promise.resolve(null));

            // Act
            hpm.put<void>('/report/pages/xyz/filters', testData.filters, { uid: testData.uniqueId })
              .then(response => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).toHaveBeenCalledWith(testData.filters);
                expect(response.statusCode).toEqual(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedEvent));
                // Cleanup
                spyApp.validateFilter.calls.reset();
                spyApp.setFilters.calls.reset();
                done();
              });
          });
      });
    });

    describe('settings', function () {

      it('PATCH /report/settings returns 400 if request is invalid', function (done) {
        // Arrange
        const testData = {
          settings: {
            filterPaneEnabled: false,
            navContentPaneEnabled: false
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validateSettings.and.returnValue(Promise.reject(null));

            // Act
            hpm.patch<models.IError[]>('/report/settings', testData.settings)
              .catch(response => {
                // Assert
                expect(spyApp.validateSettings).toHaveBeenCalledWith(testData.settings);
                expect(spyApp.updateSettings).not.toHaveBeenCalled();
                expect(response.statusCode).toEqual(400);
                // Cleanup
                spyApp.validateSettings.calls.reset();
                done();
              });
          });
      });

      it('PATCH /report/settings returns 202 if request is valid', function (done) {
        // Arrange
        const testData = {
          settings: {
            filterPaneEnabled: false,
            navContentPaneEnabled: false
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validateSettings.and.returnValue(Promise.resolve(null));

            // Act
            hpm.patch<void>('/report/settings', testData.settings)
              .then(response => {
                // Assert
                expect(spyApp.validateSettings).toHaveBeenCalledWith(testData.settings);
                expect(spyApp.updateSettings).toHaveBeenCalledWith(testData.settings);
                expect(response.statusCode).toEqual(202);
                // Cleanup
                spyApp.validateSettings.calls.reset();
                spyApp.updateSettings.calls.reset();
                done();
              });
          });
      });

      it('PATCH /report/settings causes POST /reports/:uniqueId/events/settingsUpdated', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          settings: {
            filterPaneEnabled: false
          }
        };
        const testExpectedEvent = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/settingsUpdated`,
          body: {
            initiator: 'sdk',
            settings: {
              filterPaneEnabled: false,
              navContentPaneEnabled: false
            }
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validateSettings.and.returnValue(Promise.resolve(null));
            spyApp.updateSettings.and.returnValue(Promise.resolve(testExpectedEvent.body.settings));

            // Act
            hpm.patch<void>('/report/settings', testData.settings, { uid: testData.uniqueId })
              .then(response => {
                // Assert
                setTimeout(() => {
                  expect(spyApp.validateSettings).toHaveBeenCalledWith(testData.settings);
                  expect(spyApp.updateSettings).toHaveBeenCalledWith(testData.settings);
                  expect(response.statusCode).toEqual(202);
                  expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedEvent));
                  // Cleanup
                  spyApp.validateSettings.calls.reset();
                  spyApp.updateSettings.calls.reset();

                  done();
                });
              });
          });
      });
    });
  });

  describe('MockApp-to-HPM', function () {
    describe('pages', function () {
      it('POST /reports/:uniqueId/events/pageChanged when user changes page', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          event: {
            initiator: 'user',
            newPage: {
              name: "fakePageName"
            }
          }
        };
        const testExpectedRequest = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/pageChanged`,
          body: testData.event
        };

        iframeLoaded
          .then(() => {

            // Act
            iframeHpm.post<void>(testExpectedRequest.url, testData.event)
              .then(response => {
                // Assert
                expect(response.statusCode).toBe(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedRequest));

                done();
              });

            // Cleanup
          });
      });
    });

    describe('filters (report level)', function () {
      it('POST /reports/:uniqueId/events/filtersApplied when user changes filter', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          event: {
            initiator: 'user',
            filters: [
              {
                name: "fakeFilter"
              }
            ]
          }
        };
        const testExpectedRequest = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/filtersApplied`,
          body: testData.event
        };

        iframeLoaded
          .then(() => {

            // Act
            iframeHpm.post(testExpectedRequest.url, testData.event)
              .then(response => {
                // Assert
                expect(response.statusCode).toBe(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedRequest));

                done();
              });

            // Cleanup
          });
      });
    });

    describe('filters (page level)', function () {
      it('POST /reports/:uniqueId/pages/xyz/events/filtersApplied when user changes filter', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          event: {
            initiator: 'user',
            filters: [
              {
                name: "fakeFilter"
              }
            ]
          }
        };
        const testExpectedRequest = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/pages/xyz/events/filtersApplied`,
          body: testData.event
        };

        iframeLoaded
          .then(() => {

            // Act
            iframeHpm.post(testExpectedRequest.url, testData.event)
              .then(response => {
                // Assert
                expect(response.statusCode).toBe(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedRequest));

                done();
              });

            // Cleanup
          });
      });
    });

    describe('filters (visual level)', function () {
      it('POST /reports/:uniqueId/pages/xyz/visuals/uvw/events/filtersApplied when user changes filter', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          event: {
            initiator: 'user',
            filters: [
              {
                name: "fakeFilter"
              }
            ]
          }
        };
        const testExpectedRequest = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/pages/xyz/visuals/uvw/events/filtersApplied`,
          body: testData.event
        };

        iframeLoaded
          .then(() => {

            // Act
            iframeHpm.post(testExpectedRequest.url, testData.event)
              .then(response => {
                // Assert
                expect(response.statusCode).toBe(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedRequest));

                done();
              });

            // Cleanup
          });
      });
    });

    describe('settings', function () {
      it('POST /reports/:uniqueId/events/settingsUpdated when user changes settings', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          event: {
            initiator: 'user',
            settings: {
              navContentPaneEnabled: true
            }
          }
        };
        const testExpectedRequest = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/settingsUpdated`,
          body: testData.event
        };

        iframeLoaded
          .then(() => {

            // Act
            iframeHpm.post(testExpectedRequest.url, testData.event)
              .then(response => {
                // Assert
                expect(response.statusCode).toBe(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedRequest));

                done();
              });

            // Cleanup
          });
      });
    });

    describe('data selection', function () {
      it('POST /reports/:uniqueId/events/dataSelected when user selects data', function (done) {
        // Arrange
        const testData = {
          uniqueId: 'uniqueId',
          reportId: 'fakeReportId',
          event: {
            initiator: 'user',
            selection: {
              data: true
            }
          }
        };
        const testExpectedRequest = {
          method: 'POST',
          url: `/reports/${testData.uniqueId}/events/dataSelected`,
          body: testData.event
        };

        iframeLoaded
          .then(() => {

            // Act
            iframeHpm.post(testExpectedRequest.url, testData.event)
              .then(response => {
                // Assert
                expect(response.statusCode).toBe(202);
                expect(spyHandler.handle).toHaveBeenCalledWith(jasmine.objectContaining(testExpectedRequest));
                done();
              });

            // Cleanup
          });
      });
    });
  });
});

describe('SDK-to-HPM', function () {
  let $reportElement: JQuery;
  let $dashboardElement: JQuery;
  let iframe: HTMLIFrameElement;
  let dashboardIframe: HTMLIFrameElement;
  let powerbi: service.Service;
  let report: report.Report;
  let dashboard: dashboard.Dashboard;
  let page1: page.Page;
  let visual1: visual.Visual;
  let uniqueId = 'uniqueId';
  let dashboardUniqueId = 'uniqueId';
  let embedConfiguration: embed.IEmbedConfiguration;
  let dashboardEmbedConfiguration: embed.IEmbedConfiguration;

  beforeAll(function () {
    const spyHpmFactory: factories.IHpmFactory = () => {
      return <Hpm.HttpPostMessage><any>spyHpm;
    };
    const noop: factories.IWpmpFactory = () => {
      return <Wpmp.WindowPostMessageProxy>null;
    };

    const spyRouterFactory: factories.IRouterFactory = () => {
      return <Router.Router><any>spyRouter;
    };

    powerbi = new service.Service(spyHpmFactory, noop, spyRouterFactory, { wpmpName: 'SDK-to-HPM report wpmp' });

    $reportElement = $(`<div class="powerbi-report-container"></div>`)
      .appendTo(document.body);
    $dashboardElement = $(`<div class="powerbi-dashboard-container"></div>`)
      .appendTo(document.body);

    const iframeSrc = "base/test/utility/noop.html";
    embedConfiguration = {
      type: "report",
      id: "fakeReportId",
      accessToken: 'fakeToken',
      embedUrl: iframeSrc
    };
    dashboardEmbedConfiguration = {
      type: "dashboard",
      id: "fakeDashboardId",
      accessToken: 'fakeToken',
      embedUrl: iframeSrc
    };
    report = <report.Report>powerbi.embed($reportElement[0], embedConfiguration);
    dashboard = <dashboard.Dashboard>powerbi.embed($dashboardElement[0], dashboardEmbedConfiguration);
    page1 = new page.Page(report, 'xyz');
    visual1 = new visual.Visual(page1, 'uvw');
    uniqueId = report.config.uniqueId;
    dashboardUniqueId = dashboard.config.uniqueId;
    
    iframe = <HTMLIFrameElement>$reportElement.find('iframe')[0];
    dashboardIframe = <HTMLIFrameElement>$dashboardElement.find('iframe')[0];

    // Reset load handler
    spyHpm.post.calls.reset();
  });

  afterAll(function () {
    powerbi.reset($reportElement.get(0));
    powerbi.reset($dashboardElement.get(0));
    $reportElement.remove();
    $dashboardElement.remove();
    powerbi.wpmp.stop();
  });

  afterEach(function () {
    spyHpm.get.calls.reset();
    spyHpm.post.calls.reset();
    spyHpm.patch.calls.reset();
    spyHpm.put.calls.reset();
    spyHpm.delete.calls.reset();

    spyRouter.get.calls.reset();
    spyRouter.post.calls.reset();
    spyRouter.patch.calls.reset();
    spyRouter.put.calls.reset();
    spyRouter.delete.calls.reset();
  });

  describe('report', function () {
    describe('load', function () {
      it('report.load() sends POST /report/load with configuration in body', function () {
        // Arrange
        const testData = {
          loadConfiguration: {
            id: 'fakeId',
            accessToken: 'fakeToken'
          },
          response: {
            body: null
          }
        };

        spyHpm.post.and.returnValue(Promise.resolve(testData.response));

        // Act
        report.load(testData.loadConfiguration);

        // Assert
        expect(spyHpm.post).toHaveBeenCalledWith('/report/load', testData.loadConfiguration, { uid: uniqueId }, iframe.contentWindow);
      });

      it('report.load() returns promise that rejects with validation error if the load configuration is invalid', function (done) {
        // Arrange
        const testData = {
          loadConfiguration: {
            id: 'fakeId',
            accessToken: 'fakeToken'
          },
          errorResponse: {
            body: {
              message: "invalid configuration object"
            }
          }
        };

        spyHpm.post.and.returnValue(Promise.reject(testData.errorResponse));

        // Act
        report.load(testData.loadConfiguration)
          .catch(error => {
            expect(spyHpm.post).toHaveBeenCalledWith('/report/load', testData.loadConfiguration, { uid: uniqueId }, iframe.contentWindow);
            expect(error).toEqual(testData.errorResponse.body);
            // Assert
            done();
          });
      });

      it('report.load() returns promise that resolves with null if the report load successful', function (done) {
        // Arrange
        const testData = {
          loadConfiguration: {
            id: 'fakeId',
            accessToken: 'fakeToken'
          },
          response: {
            body: null
          }
        };

        spyHpm.post.and.returnValue(Promise.resolve(testData.response));

        // Act
        report.load(testData.loadConfiguration)
          .then(response => {
            expect(spyHpm.post).toHaveBeenCalledWith('/report/load', testData.loadConfiguration, { uid: uniqueId }, iframe.contentWindow);
            expect(response).toEqual(null);
            // Assert
            done();
          });
      });

      it('report.load() updates the internal configuration if the load request was successful', function (done) {
        // Arrange
        const testData = {
          loadConfiguration: {
            id: 'newFakeId',
            accessToken: 'newFakeToken'
          },
          response: {
            body: null
          }
        };

        spyHpm.post.and.returnValue(Promise.resolve(testData.response));

        // Act
        report.load(testData.loadConfiguration)
          .then(response => {
            expect(report.config).toEqual(jasmine.objectContaining(testData.loadConfiguration));
            expect(response).toEqual(null);
            // Assert
            done();
          });
      });
    });

    describe('pages', function () {
      it('report.getPages() sends GET /report/pages', function () {
        // Arrange
        const testData = {
          response: {
            body: [
              {
                name: 'page1'
              }
            ]
          }
        };

        spyHpm.get.and.returnValue(Promise.resolve(testData.response));

        // Act
        report.getPages();

        // Assert
        expect(spyHpm.get).toHaveBeenCalledWith('/report/pages', { uid: uniqueId }, iframe.contentWindow);
      });

      it('report.getPages() return promise that rejects with server error if there was error getting pages', function (done) {
        // Arrange
        const testData = {
          expectedError: {
            body: {
              message: 'internal server error'
            }
          }
        };

        spyHpm.get.and.returnValue(Promise.reject(testData.expectedError));

        // Act
        report.getPages()
          .catch(error => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith('/report/pages', { uid: uniqueId }, iframe.contentWindow);
            expect(error).toEqual(testData.expectedError.body);
            done();
          });
      });

      it('report.getPages() returns promise that resolves with list of Page objects', function (done) {
        // Arrange
        const testData = {
          pages: [
            'page1',
            'page2'
          ],
          expectedResponse: {
            body: [
              report.page('page1'),
              report.page('page2')
            ]
          }
        };

        spyHpm.get.and.returnValue(Promise.resolve(testData.expectedResponse));

        // Act
        report.getPages()
          .then(pages => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith('/report/pages', { uid: uniqueId }, iframe.contentWindow);
            expect(pages[0].name).toEqual(testData.expectedResponse.body[0].name);
            expect(pages[1].name).toEqual(testData.expectedResponse.body[1].name);
            done();
          });
      });
    });

    describe('filters', function () {
      it('report.getFilters() sends GET /report/filters', function () {
        // Arrange
        const testData = {
          response: {
            body: [
              (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
              (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
            ]
          }
        };

        spyHpm.get.and.returnValue(Promise.resolve(testData.response));

        // Act
        report.getFilters();

        // Assert
        expect(spyHpm.get).toHaveBeenCalledWith('/report/filters', { uid: uniqueId }, iframe.contentWindow);
      });

      it('report.getFilters() returns promise that rejects with server error if there was error getting  filters', function (done) {
        // Arrange
        const testData = {
          expectedErrors: {
            body: [
              {
                message: 'target is invalid, missing property x'
              }
            ]
          }
        };

        spyHpm.get.and.returnValue(Promise.reject(testData.expectedErrors));

        // Act
        report.getFilters()
          .catch(errors => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith('/report/filters', { uid: uniqueId }, iframe.contentWindow);
            expect(errors).toEqual(jasmine.objectContaining(testData.expectedErrors.body));
            done();
          });
      });

      it('report.getFilters() returns promise that resolves with the filters if the request is accepted', function (done) {
        // Arrange
        const testData = {
          response: {
            body: [
              (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
              (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
            ]
          }
        };

        spyHpm.get.and.returnValue(Promise.resolve(testData.response));

        // Act
        report.getFilters()
          .then(filters => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith('/report/filters', { uid: uniqueId }, iframe.contentWindow);
            expect(filters).toEqual(testData.response.body);
            done();
          });
      });

      it('report.setFilters(filters) sends PUT /report/filters', function () {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
            (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
          ]
        };

        // Act
        report.setFilters(testData.filters);

        // Assert
        expect(spyHpm.put).toHaveBeenCalledWith('/report/filters', testData.filters, { uid: uniqueId }, iframe.contentWindow);
      });

      it('report.setFilters(filters) returns promise that rejects with validation errors if filter is invalid', function (done) {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
            (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
          ],
          expectedErrors: {
            body: [
              {
                message: 'target is invalid, missing property x'
              }
            ]
          }
        };

        spyHpm.put.and.returnValue(Promise.reject(testData.expectedErrors));

        // Act
        report.setFilters(testData.filters)
          .catch(errors => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith('/report/filters', testData.filters, { uid: uniqueId }, iframe.contentWindow);
            expect(errors).toEqual(jasmine.objectContaining(testData.expectedErrors.body));
            done();
          });
      });

      it('report.setFilters(filters) returns promise that resolves with null if filter was valid and request is accepted', function (done) {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
            (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
          ]
        };

        spyHpm.put.and.returnValue(Promise.resolve(null));

        // Act
        report.setFilters(testData.filters)
          .then(response => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith('/report/filters', testData.filters, { uid: uniqueId }, iframe.contentWindow);
            expect(response).toEqual(null);
            done();
          });
      });

      it('report.removeFilters() sends PUT /report/filters', function () {
        // Arrange

        // Act
        report.removeFilters();

        // Assert
        expect(spyHpm.put).toHaveBeenCalledWith('/report/filters', [], { uid: uniqueId }, iframe.contentWindow);
      });

      it('report.removeFilters() returns promise that resolves with null if request is accepted', function (done) {
        // Arrange
        spyHpm.put.and.returnValue(Promise.resolve(null));

        // Act
        report.removeFilters()
          .then(response => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith('/report/filters', [], { uid: uniqueId }, iframe.contentWindow);
            expect(response).toEqual(null);
            done();
          });
      });
    });

    describe('print', function () {
      it('report.print() sends POST /report/print', function () {
        // Arrange
        spyHpm.post.and.returnValue(Promise.resolve({
          body: {}
        }));

        // Act
        report.print();

        // Assert
        expect(spyHpm.post).toHaveBeenCalledWith('/report/print', null, { uid: uniqueId }, iframe.contentWindow);
      });

      it('report.print() returns promise that resolves if the request is accepted', function (done) {
        // Arrange
        spyHpm.post.and.returnValue(Promise.resolve({
          body: {}
        }));

        // Act
        report.print()
          .then(() => {
            // Assert
            expect(spyHpm.post).toHaveBeenCalledWith('/report/print', null, { uid: uniqueId }, iframe.contentWindow);
            done();
          });
      });
    });

    describe('refresh', function () {
      it('report.refresh() sends POST /report/refresh', function () {
        // Arrange
        spyHpm.post.and.returnValue(Promise.resolve({
          body: {}
        }));

        // Act
        report.refresh();

        // Assert
        expect(spyHpm.post).toHaveBeenCalledWith('/report/refresh', null, { uid: uniqueId }, iframe.contentWindow);
      });

      it('report.refresh() returns promise that resolves if the request is accepted', function (done) {
        // Arrange
        spyHpm.post.and.returnValue(Promise.resolve({
          body: {}
        }));

        // Act
        report.refresh()
          .then(() => {
            // Assert
            expect(spyHpm.post).toHaveBeenCalledWith('/report/refresh', null, { uid: uniqueId }, iframe.contentWindow);
            done();
          });
      });
    });

    describe('reload', function () {
      it('report.reload() sends POST /report/load with configuration in body', function () {
        // Arrange
        const testData = {
          loadConfiguration: {
            id: 'fakeId',
            accessToken: 'fakeToken'
          },
          response: {
            body: null
          }
        };

        spyHpm.post.and.returnValue(Promise.resolve(testData.response));
        report.load(testData.loadConfiguration)
          .then(() => {
            spyHpm.post.calls.reset();

            // Act
            report.reload();

            // Assert
            expect(spyHpm.post).toHaveBeenCalledWith('/report/load', jasmine.objectContaining(testData.loadConfiguration), { uid: uniqueId }, iframe.contentWindow);
          });
      });
    });

    describe('settings', function () {
      it('report.updateSettings(settings) sends PATCH /report/settings with settings object', function () {
        // Arrange
        const testData = {
          settings: {
            filterPaneEnabled: false
          }
        };

        // Act
        report.updateSettings(testData.settings);

        // Assert
        expect(spyHpm.patch).toHaveBeenCalledWith('/report/settings', testData.settings, { uid: uniqueId }, iframe.contentWindow);
      });

      it('report.updateSettings(setting) returns promise that rejects with validation error if object is invalid', function (done) {
        // Arrange
        const testData = {
          settings: {
            filterPaneEnabled: false
          },
          expectedError: {
            body: [
              {
                message: 'settings object is invalid'
              }
            ]
          }
        };

        spyHpm.patch.and.returnValue(Promise.reject(testData.expectedError));

        // Act
        report.updateSettings(testData.settings)
          .catch(errors => {

            // Assert
            expect(spyHpm.patch).toHaveBeenCalledWith('/report/settings', testData.settings, { uid: uniqueId }, iframe.contentWindow);
            expect(errors).toEqual(testData.expectedError.body);
            done()
          });
      });

      it('report.updateSettings(settings) returns promise that resolves with null if requst is valid and accepted', function (done) {
        // Arrange
        const testData = {
          settings: {
            filterPaneEnabled: false
          }
        };

        spyHpm.patch.and.returnValue(Promise.resolve(null));

        // Act
        report.updateSettings(testData.settings)
          .then(response => {

            // Assert
            expect(spyHpm.patch).toHaveBeenCalledWith('/report/settings', testData.settings, { uid: uniqueId }, iframe.contentWindow);
            expect(response).toEqual(null);
            done()
          });
      });
    });
  });
    
  describe('dashboard', function () {
    describe('load', function () {
      it('dashboard.load() sends POST /dashboard/load with configuration in body', function () {
        // Arrange
        const testData = {
          loadConfiguration: {
            id: 'fakeId',
            accessToken: 'fakeToken',
            type: 'dashboard'
          },
          response: {
            body: null
          }
        };

        spyHpm.post.and.returnValue(Promise.resolve(testData.response));

        // Act
        dashboard.load(testData.loadConfiguration);

        // Assert
        expect(spyHpm.post).toHaveBeenCalledWith('/dashboard/load', testData.loadConfiguration, { uid: dashboardUniqueId }, dashboardIframe.contentWindow);
      });
    });
  });
  
  describe('page', function () {
    describe('filters', function () {
      it('page.getFilters() sends GET /report/pages/xyz/filters', function () {
        // Arrange

        // Act
        page1.getFilters();

        // Assert
        expect(spyHpm.get).toHaveBeenCalledWith(`/report/pages/${page1.name}/filters`, { uid: uniqueId }, iframe.contentWindow);
      });

      it('page.getFilters() return promise that rejects with server error if there was error getting filters', function (done) {
        // Arrange
        const testData = {
          expectedError: {
            body: {
              message: 'internal server error'
            }
          }
        };

        spyHpm.get.and.returnValue(Promise.reject(testData.expectedError));

        // Act
        page1.getFilters()
          .catch(error => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith(`/report/pages/${page1.name}/filters`, { uid: uniqueId }, iframe.contentWindow);
            expect(error).toEqual(testData.expectedError.body);
            done();
          });
      });

      it('page.getFilters() returns promise that resolves with list of filters', function (done) {
        // Arrange
        const testData = {
          expectedResponse: {
            body: [
              { x: 'fakeFilter1' },
              { x: 'fakeFilter2' }
            ]
          }
        };

        spyHpm.get.and.returnValue(Promise.resolve(testData.expectedResponse));

        // Act
        page1.getFilters()
          .then(filters => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith(`/report/pages/${page1.name}/filters`, { uid: uniqueId }, iframe.contentWindow);
            expect(filters).toEqual(testData.expectedResponse.body);
            done();
          });
      });

      it('page.setFilters(filters) sends PUT /report/pages/xyz/filters', function () {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
            (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
          ],
          response: {
            body: []
          }
        };

        spyHpm.put.and.returnValue(Promise.resolve(testData.response));

        // Act
        page1.setFilters(testData.filters);

        // Assert
        expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${page1.name}/filters`, testData.filters, { uid: uniqueId }, iframe.contentWindow);
      });

      it('page.setFilters(filters) returns promise that rejects with validation errors if filter is invalid', function (done) {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
            (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
          ],
          expectedErrors: {
            body: [
              {
                message: 'target is invalid, missing property x'
              }
            ]
          }
        };

        spyHpm.put.and.returnValue(Promise.reject(testData.expectedErrors));

        // Act
        page1.setFilters(testData.filters)
          .catch(errors => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${page1.name}/filters`, testData.filters, { uid: uniqueId }, iframe.contentWindow);
            expect(errors).toEqual(jasmine.objectContaining(testData.expectedErrors.body));
            done();
          });
      });

      it('page.setFilters(filters) returns promise that resolves with null if filter was valid and request is accepted', function (done) {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
            (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
          ]
        };

        spyHpm.put.and.returnValue(Promise.resolve(null));

        // Act
        page1.setFilters(testData.filters)
          .then(response => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${page1.name}/filters`, testData.filters, { uid: uniqueId }, iframe.contentWindow);
            expect(response).toEqual(null);
            done();
          });
      });

      it('page.removeFilters() sends PUT /report/pages/xyz/filters', function () {
        // Arrange

        // Act
        page1.removeFilters();

        // Assert
        expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${page1.name}/filters`, [], { uid: uniqueId }, iframe.contentWindow);
      });

      it('page.removeFilters() returns promise that resolves with null if request is accepted', function (done) {
        // Arrange
        spyHpm.put.and.returnValue(Promise.resolve(null));

        // Act
        page1.removeFilters()
          .then(response => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${page1.name}/filters`, [], { uid: uniqueId }, iframe.contentWindow);
            expect(response).toEqual(null);
            done();
          });
      });
    });

    describe('setActive', function () {
      it('page.setActive() sends PUT /report/pages/active', function () {
        // Arrange
        const testData = {
          page: {
            name: page1.name,
            displayName: null
          }
        };

        spyHpm.put.and.returnValue(Promise.resolve(null));

        // Act
        page1.setActive();

        // Assert
        expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/active`, testData.page, { uid: uniqueId }, iframe.contentWindow);
      });

      it('page.setActive() returns a promise rejected with errors if the page was invalid', function (done) {
        // Arrange
        const testData = {
          page: {
            name: page1.name,
            displayName: null
          },
          response: {
            body: [
              {
                message: 'page abc123 does not exist on report xyz'
              }
            ]
          }
        };

        spyHpm.put.and.returnValue(Promise.reject(testData.response));

        // Act
        page1.setActive()
          .catch(errors => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/active`, testData.page, { uid: uniqueId }, iframe.contentWindow);
            expect(errors).toEqual(jasmine.objectContaining(testData.response.body));
            done();
          });
      });

      it('page.setActive() returns a promise resolved with null if the page is valid', function (done) {
        // Arrange
        const testData = {
          page: {
            name: page1.name,
            displayName: null
          }
        };

        spyHpm.put.and.returnValue(Promise.resolve(null));

        // Act
        page1.setActive()
          .then(response => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/active`, testData.page, { uid: uniqueId }, iframe.contentWindow);
            expect(response).toEqual(null);
            done();
          });
      });
    });

    describe('visuals', function () {
      it('page.getVisuals() sends GET /report/xyz/pages/uvw/visuals', function () {
        // Arrange
        const testData = {
          response: {
            body: [
              {
                name: 'visual1'
              }
            ]
          }
        };

        spyHpm.get.and.returnValue(Promise.resolve(testData.response));

        // Act
        page1.getVisuals();

        // Assert
        expect(spyHpm.get).toHaveBeenCalledWith(`/report/pages/${page1.name}/visuals`, { uid: uniqueId }, iframe.contentWindow);
      });

      it('page.getVisuals() returns promise rejected with error if server could not retrieve visuals', function (done) {
        // Arrange
        const testData = {
          response: {
            body: {
              message: 'could not get visuals'
            }
          }
        };

        spyHpm.get.and.returnValue(Promise.reject(testData.response));

        // Act
        page1.getVisuals()
          .catch(error => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith(`/report/pages/${page1.name}/visuals`, { uid: uniqueId }, iframe.contentWindow);
            expect(error).toEqual(jasmine.objectContaining(testData.response.body));
            done();
          });
      });

      it('page.getVisuals() returns promise resolved with visuals if request is successful', function (done) {
        // Arrange
        const testData = {
          response: {
            body: [
              {
                name: 'Visual1'
              },
              {
                name: 'Visual2'
              }
            ]
          }
        };

        spyHpm.get.and.returnValue(Promise.resolve(testData.response));

        // Act
        page1.getVisuals()
          .then(visuals => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith(`/report/pages/${page1.name}/visuals`, { uid: uniqueId }, iframe.contentWindow);
            expect(visuals[0].name).toEqual(testData.response.body[0].name);
            expect(visuals[1].name).toEqual(testData.response.body[1].name);
            done();
          });
      });
    });
  });

  describe('visuals', function () {
    describe('filters', function () {
      it('visual.getFilters() sends GET /report/pages/xyz/visuals/uvw/filters', function () {
        // Arrange

        // Act
        visual1.getFilters();

        // Assert
        expect(spyHpm.get).toHaveBeenCalledWith(`/report/pages/${visual1.page.name}/visuals/${visual1.name}/filters`, { uid: uniqueId }, iframe.contentWindow);
      });

      it('visual.getFilters() return promise that rejects with server error if there was error getting filters', function (done) {
        // Arrange
        const testData = {
          expectedError: {
            body: {
              message: 'internal server error'
            }
          }
        };

        spyHpm.get.and.returnValue(Promise.reject(testData.expectedError));

        // Act
        visual1.getFilters()
          .catch(error => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith(`/report/pages/${visual1.page.name}/visuals/${visual1.name}/filters`, { uid: uniqueId }, iframe.contentWindow);
            expect(error).toEqual(jasmine.objectContaining(testData.expectedError.body));
            done();
          });
      });

      it('visual.getFilters() returns promise that resolves with list of filters', function (done) {
        // Arrange
        const testData = {
          response: {
            body: [
              { x: 'fakeFilter1' },
              { x: 'fakeFilter2' }
            ]
          }
        };

        spyHpm.get.and.returnValue(Promise.resolve(testData.response));

        // Act
        visual1.getFilters()
          .then(filters => {
            // Assert
            expect(spyHpm.get).toHaveBeenCalledWith(`/report/pages/${visual1.page.name}/visuals/${visual1.name}/filters`, { uid: uniqueId }, iframe.contentWindow);
            expect(filters).toEqual(testData.response.body);
            done();
          });
      });

      it('visual.setFilters(filters) sends PUT /report/pages/xyz/visuals/uvw/filters', function () {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
            (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
          ]
        };

        spyHpm.put.and.returnValue(Promise.resolve(null));

        // Act
        visual1.setFilters(testData.filters);

        // Assert
        expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${visual1.page.name}/visuals/${visual1.name}/filters`, testData.filters, { uid: uniqueId }, iframe.contentWindow);
      });

      it('visual.setFilters(filters) returns promise that rejects with validation errors if filter is invalid', function (done) {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
            (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
          ],
          expectedErrors: {
            body: [
              {
                message: 'target is invalid, missing property x'
              }
            ]
          }
        };

        spyHpm.put.and.returnValue(Promise.reject(testData.expectedErrors));

        // Act
        visual1.setFilters(testData.filters)
          .catch(errors => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${visual1.page.name}/visuals/${visual1.name}/filters`, testData.filters, { uid: uniqueId }, iframe.contentWindow);
            expect(errors).toEqual(jasmine.objectContaining(testData.expectedErrors.body));
            done();
          });
      });

      it('visual.setFilters(filters) returns promise that resolves with null if filter was valid and request is accepted', function (done) {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "Cars", measure: "Make" }, "In", ["subaru", "honda"])).toJSON(),
            (new models.AdvancedFilter({ table: "Cars", measure: "Make" }, "And", [{ value: "subaru", operator: "None" }, { value: "honda", operator: "Contains" }])).toJSON()
          ]
        };

        spyHpm.put.and.returnValue(Promise.resolve(null));

        // Act
        visual1.setFilters(testData.filters)
          .then(response => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${visual1.page.name}/visuals/${visual1.name}/filters`, testData.filters, { uid: uniqueId }, iframe.contentWindow);
            expect(response).toEqual(null);
            done();
          });
      });

      it('visual.removeFilters() sends PUT /report/pages/xyz/filters', function () {
        // Arrange

        // Act
        visual1.removeFilters();

        // Assert
        expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${visual1.page.name}/visuals/${visual1.name}/filters`, [], { uid: uniqueId }, iframe.contentWindow);
      });

      it('visual.removeFilters() returns promise that resolves with null if request is accepted', function (done) {
        // Arrange
        spyHpm.put.and.returnValue(Promise.resolve(null));

        // Act
        visual1.removeFilters()
          .then(response => {
            // Assert
            expect(spyHpm.put).toHaveBeenCalledWith(`/report/pages/${visual1.page.name}/visuals/${visual1.name}/filters`, [], { uid: uniqueId }, iframe.contentWindow);
            expect(response).toEqual(null);
            done();
          });
      });
    });
  });

  describe('SDK-to-Router (Event subscription)', function () {
    /**
     * This test should likely be moved to mock app section or removed since it is already covered.
     * The validation of supported events should likely happen by powerbi instead of by the SDK
     * since this is maitanence problem
     */
    it(`report.on(eventName, handler) should throw error if eventName is not supported`, function () {
      // Arrange
      const testData = {
        eventName: 'xyz',
        handler: jasmine.createSpy('handler')
      };

      // Act
      const attemptToSubscribeToEvent = () => {
        report.on(testData.eventName, testData.handler);
      };

      // Assert
      expect(attemptToSubscribeToEvent).toThrowError();
    });
  });
});

describe('SDK-to-WPMP', function () {
  let $element: JQuery;
  let iframe: HTMLIFrameElement;
  let powerbi: service.Service;
  let report: report.Report;
  let uniqueId: string;

  beforeAll(function () {
    const spyWpmpFactory: factories.IWpmpFactory = (name?: string, logMessages?: boolean) => {
      return <Wpmp.WindowPostMessageProxy><any>spyWpmp;
    };

    powerbi = new service.Service(factories.hpmFactory, spyWpmpFactory, factories.routerFactory);

    $element = $(`<div class="powerbi-report-container"></div>`)
      .appendTo(document.body);

    const iframeSrc = "base/test/utility/noop.html";
    const embedConfiguration = {
      type: "report",
      id: "fakeReportId",
      accessToken: 'fakeToken',
      embedUrl: iframeSrc,
      wpmpName: 'SDK-to-WPMP report wpmp'
    };
    report = <report.Report>powerbi.embed($element[0], embedConfiguration);
    uniqueId = report.config.uniqueId;

    iframe = <HTMLIFrameElement>$element.find('iframe')[0];

    // Reset load handler
    spyWpmp.addHandler.calls.reset();
    spyHpm.post.calls.reset();
  });

  afterAll(function () {
    powerbi.reset($element.get(0));
    $element.remove();
    powerbi.wpmp.stop();
  });

  afterEach(function () {
    spyHpm.get.calls.reset();
    spyHpm.post.calls.reset();
    spyHpm.patch.calls.reset();
    spyHpm.put.calls.reset();
    spyHpm.delete.calls.reset();

    spyRouter.get.calls.reset();
    spyRouter.post.calls.reset();
    spyRouter.patch.calls.reset();
    spyRouter.put.calls.reset();
    spyRouter.delete.calls.reset();
  });

  describe('Event handlers', function () {
    it(`handler passed to report.on(eventName, handler) is called when POST /report/:uniqueId/events/:eventName is received`, function () {
      // Arrange
      const testData = {
        eventName: 'filtersApplied',
        handler: jasmine.createSpy('handler'),
        filtersAppliedEvent: {
          data: {
            method: 'POST',
            url: `/reports/${uniqueId}/events/filtersApplied`,
            body: {
              initiator: 'sdk',
              filters: [
                {
                  x: 'fakeFilter'
                }
              ]
            }
          }
        }
      };

      report.on(testData.eventName, testData.handler);

      // Act
      spyWpmp.onMessageReceived(testData.filtersAppliedEvent);

      // Assert
      expect(testData.handler).toHaveBeenCalledWith(jasmine.objectContaining({ detail: testData.filtersAppliedEvent.data.body }));
    });

    it(`off('eventName', handler) will remove single handler which matches function reference for that event`, function () {
      // Arrange
      const testData = {
        eventName: 'filtersApplied',
        handler: jasmine.createSpy('handler1'),
        simulatedEvent: {
          data: {
            method: 'POST',
            url: `/reports/${uniqueId}/events/filtersApplied`,
            body: {
              initiator: 'sdk',
              filter: {
                x: '1',
                y: '2'
              }
            }
          }
        }
      };

      report.on(testData.eventName, testData.handler);
      report.off(testData.eventName, testData.handler);

      // Act
      spyWpmp.onMessageReceived(testData.simulatedEvent);

      // Assert
      expect(testData.handler).not.toHaveBeenCalled();
    });

    it('if multiple handlers for the same event are registered they will all be called', function () {
      // Arrange
      const testData = {
        eventName: 'filtersApplied',
        handler: jasmine.createSpy('handler1'),
        handler2: jasmine.createSpy('handler2'),
        handler3: jasmine.createSpy('handler3'),
        simulatedEvent: {
          data: {
            method: 'POST',
            url: `/reports/${uniqueId}/events/filtersApplied`,
            body: {
              initiator: 'sdk',
              filter: {
                x: '1',
                y: '2'
              }
            }
          }
        }
      };

      report.on(testData.eventName, testData.handler);
      report.on(testData.eventName, testData.handler2);
      report.on(testData.eventName, testData.handler3);

      // Act
      spyWpmp.onMessageReceived(testData.simulatedEvent);

      // Assert
      expect(testData.handler).toHaveBeenCalledWith(jasmine.objectContaining({ detail: testData.simulatedEvent.data.body }));
      expect(testData.handler2).toHaveBeenCalledWith(jasmine.objectContaining({ detail: testData.simulatedEvent.data.body }));
      expect(testData.handler3).toHaveBeenCalledWith(jasmine.objectContaining({ detail: testData.simulatedEvent.data.body }));
    });


    it(`off('eventName') will remove all handlers which matches event name`, function () {
      // Arrange
      const testData = {
        eventName: 'filtersApplied',
        handler: jasmine.createSpy('handler1'),
        handler2: jasmine.createSpy('handler2'),
        handler3: jasmine.createSpy('handler3'),
        simulatedEvent: {
          data: {
            method: 'POST',
            url: '/reports/fakeReportId/events/filtersApplied',
            body: {
              initiator: 'sdk',
              filter: {
                x: '1',
                y: '2'
              }
            }
          }
        }
      };

      report.on(testData.eventName, testData.handler);
      report.on(testData.eventName, testData.handler2);
      report.on(testData.eventName, testData.handler3);
      report.off(testData.eventName);

      // Act
      spyWpmp.onMessageReceived(testData.simulatedEvent);

      // Assert
      expect(testData.handler).not.toHaveBeenCalled();
      expect(testData.handler2).not.toHaveBeenCalled();
      expect(testData.handler3).not.toHaveBeenCalled();
    });
  });
});

describe('SDK-to-MockApp', function () {
  let $element: JQuery;
  let $element2: JQuery;
  let iframe: HTMLIFrameElement;
  let iframe2: HTMLIFrameElement;
  let iframeHpm: Hpm.HttpPostMessage;
  let iframeHpm2: Hpm.HttpPostMessage;
  let iframeLoaded: Promise<void[]>;
  let powerbi: service.Service;
  let report: report.Report;
  let page1: page.Page;
  let visual1: visual.Visual;
  let report2: report.Report;

  beforeAll(function () {

    powerbi = new service.Service(factories.hpmFactory, factories.wpmpFactory, factories.routerFactory, {
      wpmpName: 'SDK-to-MockApp HostWpmp',
      logMessages
    });

    $element = $(`<div class="powerbi-report-container2"></div>`)
      .appendTo(document.body);

    $element2 = $(`<div class="powerbi-report-container3"></div>`)
      .appendTo(document.body);

    const iframeSrc = "base/test/utility/noop.html";
    const embedConfiguration: embed.IEmbedConfiguration = {
      type: "report",
      id: "fakeReportIdInitialEmbed",
      accessToken: 'fakeTokenInitialEmbed',
      embedUrl: iframeSrc
    };
    report = <report.Report>powerbi.embed($element[0], embedConfiguration);
    page1 = report.page('ReportSection1');
    visual1 = page1.visual('xyz');
    report2 = <report.Report>powerbi.embed($element2[0], embedConfiguration);

    iframe = <HTMLIFrameElement>$element.find('iframe')[0];
    iframe2 = <HTMLIFrameElement>$element2.find('iframe')[0];

    /**
     * Note: For testing we need to configure the eventSourceOverrideWindow to allow the host to respond to
     * the iframe window; however, the iframe window doesn't exist until the first embed is created.
     * 
     * To work around this we create a service for the initial embed, embed a report, then set the private variable
     */
    (<any>powerbi.wpmp).eventSourceOverrideWindow = iframe.contentWindow;

    // Register Iframe side
    iframeHpm = setupEmbedMockApp(iframe.contentWindow, window, logMessages, 'SDK-to-MockApp IframeWpmp');
    iframeHpm2 = setupEmbedMockApp(iframe2.contentWindow, window, logMessages, 'SDK-to-MockApp IframeWpmp2');

    // Reset load handler
    spyApp.validateLoad.calls.reset();
    spyApp.reset();

    const iframe1Loaded = new Promise<void>((resolve, reject) => {
      iframe.addEventListener('load', () => {
        resolve(null);
      });
    });
    const iframe2Loaded = new Promise<void>((resolve, reject) => {
      iframe2.addEventListener('load', () => {
        resolve(null);
      });
    });

    iframeLoaded = Promise.all<void>([iframe1Loaded, iframe2Loaded]);
  });

  afterAll(function () {
    powerbi.reset($element.get(0));
    $element.remove();
    powerbi.wpmp.stop();
  });

  afterEach(function () {
    spyApp.reset();
  });

  describe('report', function () {
    describe('load', function () {
      it(`report.load() returns promise that rejects with validation errors if load configuration is invalid`, function (done) {
        // Arrange
        const testData = {
          loadConfig: {
            id: 'fakeReportId',
            accessToken: 'fakeAccessToken'
          },
          expectedErrors: [
            {
              message: 'invalid load config'
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateLoad.and.returnValue(Promise.reject(testData.expectedErrors));
            // Act
            report.load(testData.loadConfig)
              .catch(errors => {
                // Assert
                expect(spyApp.validateLoad).toHaveBeenCalledWith(testData.loadConfig);
                expect(spyApp.load).not.toHaveBeenCalled();
                expect(errors).toEqual(jasmine.objectContaining(testData.expectedErrors));
                done();
              });
          });
      });

      it('report.load() returns promise that resolves with null if the report load successful', function (done) {
        // Arrange
        const testData = {
          loadConfig: {
            id: 'fakeReportId',
            accessToken: 'fakeAccessToken'
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validateLoad.and.returnValue(Promise.resolve(null));
            spyApp.load.and.returnValue(Promise.resolve(null));
            // Act
            report.load(testData.loadConfig)
              .then(response => {
                // Assert
                expect(spyApp.validateLoad).toHaveBeenCalledWith(testData.loadConfig);
                expect(spyApp.load).toHaveBeenCalledWith(testData.loadConfig);
                expect(response).toEqual(undefined);
                done();
              });
          });
      });
    });

    describe('pages', function () {
      it('report.getPages() return promise that rejects with server error if there was error getting pages', function (done) {
        // Arrange
        const testData = {
          expectedError: {
            message: 'internal server error'
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.getPages.and.returnValue(Promise.reject(testData.expectedError));
            // Act
            report.getPages()
              .catch(error => {
                // Assert
                expect(spyApp.getPages).toHaveBeenCalled();
                expect(error).toEqual(jasmine.objectContaining(testData.expectedError));
                done();
              });
          });
      });

      it('report.getPages() returns promise that resolves with list of page names', function (done) {
        // Arrange
        const testData = {
          pages: [
            {
              name: "page1",
              displayName: "Page 1"
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.getPages.and.returnValue(Promise.resolve(testData.pages));
            // Act
            report.getPages()
              .then(pages => {
                // Assert
                expect(spyApp.getPages).toHaveBeenCalled();
                // Workaround to compare pages
                pages
                  .forEach(page => {
                    const testPage = util.find(p => p.name === page.name, testData.pages);
                    if (testPage) {
                      expect(page.name).toEqual(testPage.name);
                    }
                    else {
                      expect(true).toBe(false);
                    }
                  });
                done();
              });
          });
      });
    });

    describe('filters', function () {
      it('report.getFilters() returns promise that rejects with server error if there was problem getting filters', function (done) {
        // Arrange
        const testData = {
          expectedError: {
            message: 'could not serialize filters'
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.getFilters.and.returnValue(Promise.reject(testData.expectedError));
            // Act
            report.getFilters()
              .catch(error => {
                // Assert
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(error).toEqual(jasmine.objectContaining(testData.expectedError));
                done();
              });
          });
      });

      it('report.getFilters() returns promise that resolves with filters is request is successful', function (done) {
        // Arrange
        const testData = {
          filters: [
            { x: 'fakeFilter' }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.getFilters.and.returnValue(Promise.resolve(testData.filters));
            // Act
            report.getFilters()
              .then(filters => {
                // Assert
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(filters).toEqual(testData.filters);
                done();
              });
          });
      });

      it('report.setFilters(filters) returns promise that rejects with validation errors if filter is invalid', function (done) {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "cars", column: "make" }, "In", ["subaru", "honda"])).toJSON()
          ],
          expectedErrors: [
            {
              message: 'invalid filter'
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateFilter.and.returnValue(Promise.reject(testData.expectedErrors));
            // Act
            report.setFilters(testData.filters)
              .catch(error => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).not.toHaveBeenCalled();
                expect(error).toEqual(jasmine.objectContaining(testData.expectedErrors));
                done();
              });
          });
      });

      it('report.setFilters(filters) returns promise that resolves with null if filter was valid and request is accepted', function (done) {
        // Arrange
        const testData = {
          filters: [(new models.BasicFilter({ table: "cars", column: "make" }, "In", ["subaru", "honda"])).toJSON()]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateFilter.and.returnValue(Promise.resolve(null));
            spyApp.setFilters.and.returnValue(Promise.resolve(null));
            // Act
            report.setFilters(testData.filters)
              .then(response => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).toHaveBeenCalledWith(testData.filters);
                done();
              });
          });
      });

      it('report.removeFilters() returns promise that resolves with null if the request was accepted', function (done) {
        // Arrange
        iframeLoaded
          .then(() => {
            spyApp.setFilters.and.returnValue(Promise.resolve(null));
            // Act
            report.removeFilters()
              .then(response => {
                // Assert
                expect(spyApp.setFilters).toHaveBeenCalled();
                done();
              });
          });
      });
    });

    describe('print', function () {
      it('report.print() returns promise that resolves with null if the report print command was accepted', function (done) {
        // Arrange
        iframeLoaded
          .then(() => {
            spyApp.print.and.returnValue(Promise.resolve(null));
            // Act
            report.print()
              .then(response => {
                // Assert
                expect(spyApp.print).toHaveBeenCalled();
                expect(response).toEqual(undefined);
                done();
              });
          });
      });
    });

    describe('refresh', function () {
      it('report.refresh() returns promise that resolves with null if the report refresh command was accepted', function (done) {
        // Arrange
        iframeLoaded
          .then(() => {
            spyApp.refreshData.and.returnValue(Promise.resolve(null));
            // Act
            report.refresh()
              .then(response => {
                // Assert
                expect(spyApp.refreshData).toHaveBeenCalled();
                expect(response).toEqual(undefined);
                done();
              });
          });
      });
    });

    describe('settings', function () {
      it('report.updateSettings(setting) returns promise that rejects with validation error if object is invalid', function (done) {
        // Arrange
        const testData = {
          settings: {
            filterPaneEnabled: false
          },
          expectedErrors: [
            {
              message: 'invalid target'
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateSettings.and.returnValue(Promise.reject(testData.expectedErrors));
            // Act
            report.updateSettings(testData.settings)
              .catch(errors => {
                // Assert
                expect(spyApp.validateSettings).toHaveBeenCalledWith(testData.settings);
                expect(spyApp.updateSettings).not.toHaveBeenCalled();
                expect(errors).toEqual(jasmine.objectContaining(testData.expectedErrors));
                done();
              });
          });
      });

      it('report.updateSettings(settings) returns promise that resolves with null if requst is valid and accepted', function (done) {
        // Arrange
        const testData = {
          settings: {
            filterPaneEnabled: false
          },
          expectedErrors: [
            {
              message: 'invalid target'
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateSettings.and.returnValue(Promise.resolve(null));
            spyApp.updateSettings.and.returnValue(Promise.resolve(null));
            // Act
            report.updateSettings(testData.settings)
              .then(response => {
                // Assert
                expect(spyApp.validateSettings).toHaveBeenCalledWith(testData.settings);
                expect(spyApp.updateSettings).toHaveBeenCalledWith(testData.settings);
                done();
              });
          });
      });
    });
  });

  describe('page', function () {
    describe('filters', function () {
      it('page.getFilters() returns promise that rejects with server error if there was problem getting filters', function (done) {
        // Arrange
        const testData = {
          expectedError: {
            message: 'could not serialize filters'
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.getFilters.and.returnValue(Promise.reject(testData.expectedError));
            // Act
            page1.getFilters()
              .catch(error => {
                // Assert
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(error).toEqual(jasmine.objectContaining(testData.expectedError));
                done();
              });
          });
      });

      it('page.getFilters() returns promise that resolves with filters is request is successful', function (done) {
        // Arrange
        const testData = {
          filters: [
            { x: 'fakeFilter' }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.getFilters.and.returnValue(Promise.resolve(testData.filters));
            // Act
            page1.getFilters()
              .then(filters => {
                // Assert
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(filters).toEqual(testData.filters);
                done();
              });
          });
      });

      it('page.setFilters(filters) returns promise that rejects with validation errors if filter is invalid', function (done) {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "cars", column: "make" }, "In", ["subaru", "honda"])).toJSON()
          ],
          expectedErrors: [
            {
              message: 'invalid filter'
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateFilter.and.returnValue(Promise.reject(testData.expectedErrors));
            // Act
            page1.setFilters(testData.filters)
              .catch(error => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).not.toHaveBeenCalled();
                expect(error).toEqual(jasmine.objectContaining(testData.expectedErrors));
                done();
              });
          });
      });

      it('page.setFilters(filters) returns promise that resolves with null if filter was valid and request is accepted', function (done) {
        // Arrange
        const testData = {
          filters: [(new models.BasicFilter({ table: "cars", column: "make" }, "In", ["subaru", "honda"])).toJSON()]
        };

        iframeLoaded
          .then(() => {
            spyApp.validateFilter.and.returnValue(Promise.resolve(null));
            spyApp.setFilters.and.returnValue(Promise.resolve(null));
            // Act
            page1.setFilters(testData.filters)
              .then(response => {
                // Assert
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).toHaveBeenCalledWith(testData.filters);
                done();
              });
          });
      });

      it('page.removeFilters() returns promise that resolves with null if the request was accepted', function (done) {
        // Arrange
        iframeLoaded
          .then(() => {
            spyApp.setFilters.and.returnValue(Promise.resolve(null));
            // Act
            page1.removeFilters()
              .then(response => {
                // Assert
                expect(spyApp.setFilters).toHaveBeenCalled();
                done();
              });
          });
      });
    });

    describe('visuals', function () {
      it('page.getVisuals() returns promise that rejects with validation errors if page is invalid', function (done) {
        // Arrange
        const testData = {
          errors: [
            { message: 'page xyz was not found in report' }
          ]
        };

        // Act
        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.reject(testData.errors));
            // Act
            page1.getVisuals()
              .catch(errors => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                expect(spyApp.getVisuals).not.toHaveBeenCalled();
                expect(errors).toEqual(jasmine.objectContaining(testData.errors));
                done();
              });
          });
      });

      it('page.getVisuals() returns promise that resolves with list of visuals on that page', function (done) {
        // Arrange
        const testData = {
          visuals: [
            { name: 'Visual1' }
          ]
        };

        // Arrange
        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.resolve(null));
            spyApp.getVisuals.and.returnValue(Promise.resolve(testData.visuals));
            // Act
            page1.getVisuals()
              .then(visuals => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                expect(spyApp.getVisuals).toHaveBeenCalled();
                expect(visuals[0].name).toEqual(testData.visuals[0].name);
                done();
              });
          });
      });
    });

    describe('setActive', function () {
      it('page.setActive() returns promise that rejects if page is invalid', function (done) {
        // Arrange
        const testData = {
          errors: [
            {
              message: 'page xyz was not found in report'
            }
          ]
        };

        // Act
        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.reject(testData.errors));

            // Act
            page1.setActive()
              .catch(errors => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                expect(spyApp.setPage).not.toHaveBeenCalled();
                expect(errors).toEqual(jasmine.objectContaining(testData.errors));
                done();
              });
          });
      });

      it('page.setActive() returns promise that resolves with null if request is successful', function (done) {
        // Arrange
        const testData = {
          errors: [
            {
              message: 'page xyz was not found in report'
            }
          ]
        };

        // Act
        iframeLoaded
          .then(() => {
            setTimeout(() => {
              spyApp.validatePage.and.returnValue(Promise.resolve(null));
              spyApp.setPage.and.returnValue(Promise.resolve(null));
              // Act
              page1.setActive()
                .then(() => {
                  // Assert
                  expect(spyApp.validatePage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                  expect(spyApp.setPage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                  done();
                });
            }, 500);
          });
      });
    });
  });

  describe('visual', function () {
    describe('filters', function () {
      it('visual.getFilters() returns promise that rejects with validation errors if the page or visual was invalid', function (done) {
        // Arrange
        const testData = {
          errors: [
            {
              message: 'visual uvw was not found on page xyx'
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.resolve(null));
            spyApp.validateVisual.and.returnValue(Promise.reject(testData.errors));
            // Act
            visual1.getFilters()
              .catch(error => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                expect(spyApp.validateVisual).toHaveBeenCalled();
                expect(spyApp.getFilters).not.toHaveBeenCalled();
                expect(error).toEqual(jasmine.objectContaining(testData.errors));
                done();
              });
          });
      });

      it('visual.getFilters() returns promise that rejects with server error if there was problem getting filters', function (done) {
        // Arrange
        const testData = {
          expectedError: {
            message: 'could not serialize filters'
          }
        };

        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.resolve(undefined));
            spyApp.validateVisual.and.returnValue(Promise.resolve(undefined));
            spyApp.getFilters.and.returnValue(Promise.reject(testData.expectedError));
            // Act
            visual1.getFilters()
              .catch(error => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                expect(spyApp.validateVisual).toHaveBeenCalled();
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(error).toEqual(jasmine.objectContaining(testData.expectedError));
                done();
              });
          });
      });

      it('visual.getFilters() returns promise that resolves with filters is request is successful', function (done) {
        // Arrange
        const testData = {
          filters: [
            { x: 'fakeFilter' }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.resolve(null));
            spyApp.validateVisual.and.returnValue(Promise.resolve(null));
            spyApp.getFilters.and.returnValue(Promise.resolve(testData.filters));
            // Act
            visual1.getFilters()
              .then(filters => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                expect(spyApp.validateVisual).toHaveBeenCalled();
                expect(spyApp.getFilters).toHaveBeenCalled();
                expect(filters).toEqual(testData.filters);
                done();
              });
          });
      });

      it('visual.setFilters(filters) returns promise that rejects with validation errors if filter is invalid', function (done) {
        // Arrange
        const testData = {
          filters: [
            (new models.BasicFilter({ table: "cars", column: "make" }, "In", ["subaru", "honda"])).toJSON()
          ],
          errors: [
            {
              message: 'invalid filter'
            }
          ]
        };

        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.resolve(undefined));
            spyApp.validateVisual.and.returnValue(Promise.resolve(undefined));
            spyApp.validateFilter.and.returnValue(Promise.reject(testData.errors));
            // Act
            visual1.setFilters(testData.filters)
              .catch(errors => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                expect(spyApp.validateVisual).toHaveBeenCalled(); //.toHaveBeenCalledWith(visual1);
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).not.toHaveBeenCalled();
                expect(errors).toEqual(jasmine.objectContaining(testData.errors));
                done();
              });
          });
      });

      it('visual.setFilters(filters) returns promise that resolves with null if filter was valid and request is accepted', function (done) {
        // Arrange
        const testData = {
          filters: [(new models.BasicFilter({ table: "cars", column: "make" }, "In", ["subaru", "honda"])).toJSON()]
        };

        iframeLoaded
          .then(() => {
            spyApp.validatePage.and.returnValue(Promise.resolve(null));
            spyApp.validateVisual.and.returnValue(Promise.resolve(null));
            spyApp.validateFilter.and.returnValue(Promise.resolve(null));
            spyApp.setFilters.and.returnValue(Promise.resolve(null));
            // Act
            visual1.setFilters(testData.filters)
              .then(response => {
                // Assert
                expect(spyApp.validatePage).toHaveBeenCalled(); //.toHaveBeenCalledWith(page1);
                expect(spyApp.validateVisual).toHaveBeenCalled(); //.toHaveBeenCalledWith(visual1);
                expect(spyApp.validateFilter).toHaveBeenCalledWith(testData.filters[0]);
                expect(spyApp.setFilters).toHaveBeenCalledWith(testData.filters);
                done();
              });
          });
      });

      it('visual.removeFilters() returns promise that resolves with null if the request was accepted', function (done) {
        // Arrange
        iframeLoaded
          .then(() => {
            spyApp.setFilters.and.returnValue(Promise.resolve(null));
            // Act
            page1.removeFilters()
              .then(response => {
                // Assert
                expect(spyApp.setFilters).toHaveBeenCalled();
                done();
              });
          });
      });
    });
  });

  describe('SDK-to-Router (Event subscription)', function () {
    it(`report.on(eventName, handler) should throw error if eventName is not supported`, function () {
      // Arrange
      const testData = {
        eventName: 'xyz',
        handler: jasmine.createSpy('handler')
      };

      // Act
      const attemptToSubscribeToEvent = () => {
        report.on(testData.eventName, testData.handler);
      };

      // Assert
      expect(attemptToSubscribeToEvent).toThrowError();
    });

    it(`report.on(eventName, handler) should register handler and be called when POST /report/:uniqueId/events/:eventName is received`, function (done) {
      // Arrange
      const testData = {
        reportId: 'fakeReportId',
        eventName: 'pageChanged',
        handler: jasmine.createSpy('handler'),
        simulatedPageChangeBody: {
          initiator: 'sdk',
          newPage: {
            name: 'page1',
            displayName: 'Page 1'
          }
        },
        expectedEvent: {
          detail: {
            initiator: 'sdk',
            newPage: report.page('page1')
          }
        }
      };
      const testDataHandler: jasmine.Spy = testData.handler;

      report.on(testData.eventName, testData.handler);

      // Act
      iframeHpm.post(`/reports/${report.config.uniqueId}/events/${testData.eventName}`, testData.simulatedPageChangeBody)
        .then(response => {
          // Assert
          expect(testData.handler).toHaveBeenCalledWith(jasmine.any(CustomEvent));
          // Workaround to compare pages which prevents recursive loop in jasmine equals
          // expect(testData.handler2).toHaveBeenCalledWith(jasmine.objectContaining({ detail: testData.simulatedPageChangeBody }));
          expect(testData.handler.calls.mostRecent().args[0].detail.newPage.name).toEqual(testData.expectedEvent.detail.newPage.name);
          done();
        });
    });

    it(`if multiple reports with the same id are loaded into the host, and event occurs on one of them, only one report handler should be called`, function (done) {
      // Arrange
      const testData = {
        reportId: 'fakeReportId',
        eventName: 'pageChanged',
        handler: jasmine.createSpy('handler'),
        handler2: jasmine.createSpy('handler2'),
        simulatedPageChangeBody: {
          initiator: 'sdk',
          newPage: {
            name: 'page1',
            displayName: 'Page 1'
          }
        }
      };

      report.on(testData.eventName, testData.handler);
      report2.on(testData.eventName, testData.handler2);

      // Act
      iframeHpm.post(`/reports/${report2.config.uniqueId}/events/${testData.eventName}`, testData.simulatedPageChangeBody)
        .then(response => {
          // Assert
          expect(testData.handler2).toHaveBeenCalledWith(jasmine.any(CustomEvent));
          // Workaround to compare pages which prevents recursive loop in jasmine equals
          // expect(testData.handler).toHaveBeenCalledWith(jasmine.objectContaining(testData.expectedEvent));
          expect(testData.handler2.calls.mostRecent().args[0].detail.newPage.name).toEqual(testData.simulatedPageChangeBody.newPage.name);
          expect(testData.handler).not.toHaveBeenCalled();
          done();
        });
    });

    it(`ensure load event is allowed`, function (done) {
      // Arrange
      const testData = {
        reportId: 'fakeReportId',
        eventName: 'loaded',
        handler: jasmine.createSpy('handler3'),
        simulatedBody: {
          initiator: 'sdk'
        }
      };

      report.on(testData.eventName, testData.handler);

      // Act
      iframeHpm.post(`/reports/${report.config.uniqueId}/events/${testData.eventName}`, testData.simulatedBody)
        .then(response => {
          // Assert
          expect(testData.handler).toHaveBeenCalledWith(jasmine.any(CustomEvent));
          expect(testData.handler).toHaveBeenCalledWith(jasmine.objectContaining({ detail: testData.simulatedBody }));
          done();
        });
    });
  });
});