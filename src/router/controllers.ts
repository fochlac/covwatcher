import { branchDb } from '../modules/db/branches'
import error from '../utils/error'
import { getBaseBranchFromPullrequest } from '../modules/bitbucket/get-base-branch'
import { pullRequestDb } from '../modules/db/pull-requests'
import { writeReportToBitbucket } from '../modules/bitbucket/comment'

const { routerError, internalError } = error('controllers:')

export const addBranchReport = async (req, res) => {
	const { name, repository, report } = req.body
	const action = (await branchDb.exists(repository, name)) ? branchDb.update : branchDb.create

	action({ name, repository, report })
		.then(() => {
			res.status(200).send({ success: true })
		})
		.catch(routerError(2, res, 'Error creating branch.'))
}

export const addPullRequestReport = async (req, res) => {
	try {
		const pullRequestRest = req.body as Core.PullRequestRest
		const action = (await pullRequestDb.exists(pullRequestRest.repository, pullRequestRest.name))
			? pullRequestDb.update
			: pullRequestDb.create
		const base = await getBaseBranchFromPullrequest(pullRequestRest)

		const pr = await action(pullRequestRest, base)
		const baseBranch = await branchDb.get(base.repository, base.name)

		res.status(200).send({ success: true })

		if (!baseBranch) throw 'Base branch is not in the database.'
		writeReportToBitbucket(baseBranch, pr)
	} catch (err) {
		internalError(2, 'Error handling pull request:')(err)
	}
}
