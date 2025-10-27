import request from '/@/utils/request';

export function getUniteLoginUrl(params: any) {
	return request({
		url: 'http://127.0.0.1:9999',
		method: 'GET',
		params,
	});
}
