import './mock-config'

import { reportRaw, reportRaw2 } from './data/reports'

import logger from '../utils/logger'
import { mockBranchRest } from './data/branches'
import { mockPullRequestRest } from './data/pullrequests'
import nock from 'nock'
import { router } from '../router'
import supertest from 'supertest'

jest.mock('../utils/file-db')
jest.mock('../utils/logger')
jest.mock('fs-extra', () => {
	let data = {}

	return {
		outputFile: jest.fn((file, content) => {
			data[file] = content
			return Promise.resolve()
		}),
		readJSON: jest.fn(file => Promise.resolve(JSON.parse(data[file]))),
	}
})

describe('upload branch, upload pr, expect repo', () => {
	afterEach(() => {
		// @ts-ignore
		logger.mockClear()
	})

	it('should send svgs', async () => {
		const response = await supertest(router).get('/svg/arrow-up.svg')

		expect(response.statusCode).toBe(200)
		expect(response).toMatchObject({
			header: {
				'accept-ranges': 'bytes',
				'cache-control': 'public, max-age=0',
				connection: 'close',
				'content-type': 'image/svg+xml',
				vary: 'Accept-Encoding',
				'x-powered-by': 'Express',
			},
		})

		//@ts-ignore
		expect(logger.mock.calls).toMatchSnapshot()
	})

	it('should create branch, create pullrequest and send comment', async () => {
		const bitbucket = nock('http://test.bitbucket.server:8080')
			.get('/rest/api/1.0/users/slug/repos/name/pull-requests/12345/')
			.reply('200', {
				toRef: {
					displayId: mockBranchRest.name,
					repository: {
						slug: mockBranchRest.repository.repo,
						project: {
							key: mockBranchRest.repository.project,
							type: 'USERS',
						},
					},
				},
			})
			.post('/rest/api/1.0/users/slug/repos/name/pull-requests/12345/comments/')
			.reply(200, { version: 0, id: 1 })

		const response_branch = await supertest(router)
			.post('/api/branch')
			.send({ ...mockBranchRest, report: reportRaw })

		const response_pr = await supertest(router)
			.post('/api/pullrequest')
			.send({ ...mockPullRequestRest, report: reportRaw })

		expect(response_branch.statusCode).toBe(200)
		expect(response_branch.body).toMatchSnapshot()
		expect(response_pr.statusCode).toBe(200)
		expect(response_pr.body).toMatchSnapshot()
		expect(bitbucket.isDone()).toBeTruthy()

		//@ts-ignore
		expect(logger.mock.calls).toMatchSnapshot()
	})

	it('should update pullrequest and update comment', async () => {
		const bitbucket = nock('http://test.bitbucket.server:8080')
			.get('/rest/api/1.0/users/slug/repos/name/pull-requests/12345/')
			.reply('200', {
				toRef: {
					displayId: mockBranchRest.name,
					repository: {
						slug: mockBranchRest.repository.repo,
						project: {
							key: mockBranchRest.repository.project,
							type: 'USERS',
						},
					},
				},
			})
			.get('/rest/api/1.0/users/slug/repos/name/pull-requests/12345/comments/1')
			.reply(200, { version: 2, id: 1 })
			.put('/rest/api/1.0/users/slug/repos/name/pull-requests/12345/comments/1', { version: 2, text: /.*/ })
			.reply(200, { version: 3, id: 1 })

		const response_pr = await supertest(router)
			.post('/api/pullrequest')
			.send({ ...mockPullRequestRest, report: reportRaw })

		expect(response_pr.statusCode).toBe(200)
		expect(response_pr.body).toMatchSnapshot()

		expect(bitbucket.isDone()).toBeTruthy()

		//@ts-ignore
		expect(logger.mock.calls).toMatchSnapshot()
	})

	it('should update branch, update comment and create task', async () => {
		const bitbucket = nock('http://test.bitbucket.server:8080')
			.get('/rest/api/1.0/users/slug/repos/name/pull-requests/12345/')
			.reply('200', {
				toRef: {
					displayId: mockBranchRest.name,
					repository: {
						slug: mockBranchRest.repository.repo,
						project: {
							key: mockBranchRest.repository.project,
							type: 'USERS',
						},
					},
				},
			})
			.get('/rest/api/1.0/users/slug/repos/name/pull-requests/12345/comments/1')
			.reply(200, { version: 2, id: 1 })
			.put('/rest/api/1.0/users/slug/repos/name/pull-requests/12345/comments/1')
			.reply(200, { version: 3, id: 1 })
			.post('/rest/api/1.0/tasks/')
			.reply(200, { id: 1 })

		const response_branch = await supertest(router)
			.post('/api/branch')
			.send({ ...mockBranchRest, report: reportRaw2 })

		const response_pr = await supertest(router)
			.post('/api/pullrequest')
			.send({ ...mockPullRequestRest, task: 1, report: reportRaw })

		expect(response_branch.statusCode).toBe(200)
		expect(response_branch.body).toMatchSnapshot()
		expect(response_pr.statusCode).toBe(200)
		expect(response_pr.body).toMatchSnapshot()

		expect(bitbucket.isDone()).toBeTruthy()

		//@ts-ignore
		expect(logger.mock.calls).toMatchSnapshot()
	})
})
