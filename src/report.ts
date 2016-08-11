import * as service from './service';
import * as embed from './embed';
import * as models from 'powerbi-models';
import * as wpmp from 'window-post-message-proxy';
import * as hpm from 'http-post-message';
import * as utils from './util';
import { IFilterable } from './ifilterable';
import { IPageNode, Page } from './page';

/**
 * A Report node within a report hierarchy
 * 
 * @export
 * @interface IReportNode
 */
export interface IReportNode {
    iframe: HTMLIFrameElement;
    service: service.IService;
    config: embed.IInternalEmbedConfiguration
}

/**
 * A Power BI Report embed component
 * 
 * @export
 * @class Report
 * @extends {embed.Embed}
 * @implements {IReportNode}
 * @implements {IFilterable}
 */
export class Report extends embed.Embed implements IReportNode, IFilterable {
    static allowedEvents = ["dataSelected", "filtersApplied", "pageChanged", "error"];
    static reportIdAttribute = 'powerbi-report-id';
    static filterPaneEnabledAttribute = 'powerbi-settings-filter-pane-enabled';
    static navContentPaneEnabledAttribute = 'powerbi-settings-nav-content-pane-enabled';
    static typeAttribute = 'powerbi-type';
    static type = "Report";

    /**
     * Creates an instance of a Power BI Report.
     * 
     * @param {service.Service} service
     * @param {HTMLElement} element
     * @param {embed.IEmbedConfiguration} config
     */
    constructor(service: service.Service, element: HTMLElement, config: embed.IEmbedConfiguration) {
        const filterPaneEnabled = (config.settings && config.settings.filterPaneEnabled) || !(element.getAttribute(Report.filterPaneEnabledAttribute) === "false");
        const navContentPaneEnabled = (config.settings && config.settings.navContentPaneEnabled) || !(element.getAttribute(Report.navContentPaneEnabledAttribute) === "false");
        const settings = utils.assign({
            filterPaneEnabled,
            navContentPaneEnabled
        }, config.settings);
        const configCopy = utils.assign({ settings }, config);

        super(service, element, configCopy);
        Array.prototype.push.apply(this.allowedEvents, Report.allowedEvents);
    }

    /**
     * This adds backwards compatibility for older config which used the reportId query param to specify report id.
     * E.g. http://embedded.powerbi.com/appTokenReportEmbed?reportId=854846ed-2106-4dc2-bc58-eb77533bf2f1
     * 
     * By extracting the id we can ensure id is always explicitly provided as part of the load configuration.
     * 
     * @static
     * @param {string} url
     * @returns {string}
     */
    static findIdFromEmbedUrl(url: string): string {
        const reportIdRegEx = /reportId="?([^&]+)"?/
        const reportIdMatch = url.match(reportIdRegEx);

        let reportId;
        if (reportIdMatch) {
            reportId = reportIdMatch[1];
        }

        return reportId;
    }

    /**
     * Get filters that are applied at the report level
     * 
     * ```javascript
     * // Get filters applied at report level
     * report.getFilters()
     *   .then(filters => {
     *     ...
     *   });
     * ```
     * 
     * @returns {Promise<models.IFilter[]>}
     */
    getFilters(): Promise<models.IFilter[]> {
        return this.service.hpm.get<models.IFilter[]>(`/report/filters`, { uid: this.config.uniqueId }, this.iframe.contentWindow)
            .then(response => response.body,
            response => {
                throw response.body;
            });
    }

    /**
     * Get report id from first available location: options, attribute, embed url.
     * 
     * @returns {string}
     */
    getId(): string {
        const reportId = this.config.id || this.element.getAttribute(Report.reportIdAttribute) || Report.findIdFromEmbedUrl(this.config.embedUrl);

        if (typeof reportId !== 'string' || reportId.length === 0) {
            throw new Error(`Report id is required, but it was not found. You must provide an id either as part of embed configuration or as attribute '${Report.reportIdAttribute}'.`);
        }

        return reportId;
    }

    /**
     * Get the list of pages within the report
     * 
     * ```javascript
     * report.getPages()
     *  .then(pages => {
     *      ...
     *  });
     * ```
     * 
     * @returns {Promise<Page[]>}
     */
    getPages(): Promise<Page[]> {
        return this.service.hpm.get<models.IPage[]>('/report/pages', { uid: this.config.uniqueId }, this.iframe.contentWindow)
            .then(response => {
                return response.body
                    .map(page => {
                        return new Page(this, page.name, page.displayName);
                    });
            }, response => {
                throw response.body;
            });
    }

    /**
     * Create new Page instance.
     * 
     * Normally you would get Page objects by calling `report.getPages()` but in the case
     * that the page name is known and you want to perform an action on a page without having to retrieve it
     * you can create it directly.
     * 
     * Note: Since you are creating the page manually there is no guarantee that the page actually exists in the report and the subsequence requests could fail.
     * 
     * ```javascript
     * const page = report.page('ReportSection1');
     * page.setActive();
     * ```
     * 
     * @param {string} name
     * @param {string} [displayName]
     * @returns {Page}
     */
    page(name: string, displayName?: string): Page {
        return new Page(this, name, displayName);
    }

    /**
     * Remove all filters at report level
     * 
     * ```javascript
     * report.removeFilters();
     * ```
     * 
     * @returns {Promise<void>}
     */
    removeFilters(): Promise<void> {
        return this.setFilters([]);
    }

    /**
     * Set the active page
     * 
     * ```javascript
     * report.setPage("page2")
     *  .catch(error => { ... });
     * ```
     * 
     * @param {string} pageName
     * @returns {Promise<void>}
     */
    setPage(pageName: string): Promise<void> {
        const page: models.IPage = {
            name: pageName,
            displayName: null
        };

        return this.service.hpm.put<models.IError[]>('/report/pages/active', page, { uid: this.config.uniqueId }, this.iframe.contentWindow)
            .catch(response => {
                throw response.body;
            });
    }

    /**
     * Sets filters
     * 
     * ```javascript
     * const filters: [
     *    ...
     * ];
     * 
     * report.setFilters(filters)
     *  .catch(errors => {
     *    ...
     *  });
     * ```
     * 
     * @param {((models.IBasicFilter | models.IAdvancedFilter)[])} filters
     * @returns {Promise<void>}
     */
    setFilters(filters: (models.IBasicFilter | models.IAdvancedFilter)[]): Promise<void> {
        return this.service.hpm.put<models.IError[]>(`/report/filters`, filters, { uid: this.config.uniqueId }, this.iframe.contentWindow)
            .catch(response => {
                throw response.body;
            });
    }

    /**
     * Update settings of report (filter pane visibility, page navigation visibility)
     * 
     * ```javascript
     * const newSettings = {
     *   navContentPaneEnabled: true,
     *   filterPaneEnabled: false
     * };
     * 
     * report.updateSettings(newSettings)
     *   .catch(error => { ... });
     * ```
     * 
     * @param {models.ISettings} settings
     * @returns {Promise<void>}
     */
    updateSettings(settings: models.ISettings): Promise<void> {
        return this.service.hpm.patch<models.IError[]>('/report/settings', settings, { uid: this.config.uniqueId }, this.iframe.contentWindow)
            .catch(response => {
                throw response.body;
            });
    }
}