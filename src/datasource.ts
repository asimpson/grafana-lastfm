import { lastValueFrom } from 'rxjs';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { getBackendSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions, defaultQuery } from './types';

interface Tracks {
  track: [
    {
      name: string;
      date: {
        uts: string;
      };
    }
  ];
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  url?: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.url = instanceSettings.url;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const resp = await lastValueFrom(
      getBackendSrv().fetch({
        url: this.url + '/tracks?limit=200&user=' + defaultQuery.user,
      })
    );

    const d = resp.data as Record<string, Tracks>;
    const validDates = d.recenttracks.track.filter((x) => x.date).map((x) => new Date(parseInt(x.date.uts, 10) * 1000));
    const consolidateDays = [];

    for (const singleDate of validDates) {
      const sameDay = consolidateDays.filter(
        (pd) => pd.getDate() === singleDate.getDate() && pd.getMonth() === singleDate.getMonth()
      );
      if (!sameDay.length) {
        consolidateDays.push(singleDate);
      }
    }

    const playCounts = consolidateDays.map(
      (x) => validDates.filter((pd) => pd.getDate() === x.getDate() && pd.getMonth() === x.getMonth()).length
    );

    const frame = new MutableDataFrame({
      refId: 'recentlyPlayed',
      fields: [
        { name: 'Time', values: consolidateDays, type: FieldType.time },
        { name: 'Plays', values: playCounts, type: FieldType.number },
      ],
    });

    return { data: [frame] };
  }

  async testDatasource() {
    const resp = await lastValueFrom(
      getBackendSrv().fetch({
        url: this.url + '/info?user=rj',
      })
    );
    return {
      status: resp.status === 200 ? 'success' : 'failure',
      message: resp.status === 200 ? 'API Key valid!' : 'API Key invalid!',
    };
  }
}
