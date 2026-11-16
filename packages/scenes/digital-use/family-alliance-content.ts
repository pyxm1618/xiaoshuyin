/**
 * Family Alliance product-authority content projected verbatim from the frozen
 * V1 Product Requirements authority. This registry is product authority only:
 * it does not assert Professional Reviewer approval.
 */
export const FAMILY_ALLIANCE_CONTENT_VERSION = 'family-alliance-product-v1' as const;
export const FAMILY_ALLIANCE_AUTHORITY_DOCUMENT = 'Docs/V1产品需求.md' as const;
export const FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION = 'v3.9' as const;
export const FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB = '8eb660cd905d8fba4b52fe0f74bbc214b3113117' as const;

export const FAMILY_ALLIANCE_CONTENT_NODE_CODES = ["A3000","A3013","A3033","A3043","A3053","A3063","A3073","A3083","A3093","A3103","A3113"] as const;
export type FamilyAllianceContentNodeCode = typeof FAMILY_ALLIANCE_CONTENT_NODE_CODES[number];

export interface FamilyAllianceContentAsset {
  readonly nodeCode: FamilyAllianceContentNodeCode;
  readonly contentVersion: typeof FAMILY_ALLIANCE_CONTENT_VERSION;
  readonly authorityDocument: typeof FAMILY_ALLIANCE_AUTHORITY_DOCUMENT;
  readonly authorityDocumentVersion: typeof FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION;
  readonly sourceBlob: typeof FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB;
  readonly sectionHeading: string;
  readonly body: string;
}

const FAMILY_ALLIANCE_CONTENT = Object.freeze({
  A3000: Object.freeze({
    nodeCode: 'A3000' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "建立家庭手机使用联盟的原则和注意事项",
    body: "1.  为了帮助孩子养成良好的使用手机的习惯，所有家庭成员需要共同参与、互相配合。达成“一致”意见比选择“正确”的意见更重要。哪怕最终的选择（决定）在你看来不是最好的，但是为了达成一致，你也可以先做出让步和妥协。这一点非常重要。\n\n2.  家长需要处理好自己的情绪并且为孩子提供情绪支持。\n\n3.  家长需要规范自身使用手机的习惯\n\n4.  家长需要用协商的方式或者孩子的同意和认可，而不是用命令的方式强制孩子执行\n\n5.  对于那些主要由妈妈负责管教孩子，爸爸忙于工作的家庭，爸爸需要尽可能的参与，至少需要了解这个家庭联盟并且配合其他人。祖父母也需要了解和配合。\n\n可以尝试的一些家庭规则：\n\n在家庭的某些区域，手机不能进入。比如洗手间，厨房，或者餐厅\n\n在某些场合，所有人都不能使用手机，比如餐桌上吃饭的时候，但是如果有来点可以离开餐桌接电话\n\n每周抽出一个特定的时段，比如每周半天或者一天时间，全家人不用手机，接电话除外\n\n用手机的时候就专门使用手机，不要一边玩手机一边做其他的事情",
  }),
  A3013: Object.freeze({
    nodeCode: 'A3013' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（改善睡眠）",
    body: "对常见的问题进行解答\n\n1.  睡眠时间：\n\n    学生8-9小时\n\n    事实上很多学生不能睡够这么长时间，所以睡眠质量更加重要，睡眠质量主要以第二天的主观感觉来判断\n\n2.  熬夜：\n\n    是否一定不能熬夜？如果睡得晚醒的也晚的话其实没有关系，但是学生通常要起得早，所以不要熬夜。即使是周末也不要熬夜。应该保持一种7天入睡时间和起床时间都是一样的，不要在周末睡懒觉，如果确实需要补觉的，可以例外\n\n3.  磨蹭、拖延导致睡觉迟//起床拖延\n\n    家长尽量不要催促，可以使用任务评估表里面的维度和孩子一起来讨论这个问题。",
  }),
  A3033: Object.freeze({
    nodeCode: 'A3033' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（运动）",
    body: "对常见的问题进行解答\n\n运动可以是体育运动，也可以是游戏，也可以是孩子自主设计的活动，但是不能是棋牌桌游类\n\n运动的目的是锻炼心肺能力，提高大脑供氧，增加多巴胺\n\n运动能够让机体分泌多巴胺，让人更加愉悦\n\n如果孩子不愿意自己运动，也可以考虑去报兴趣班，学习运动技能",
  }),
  A3043: Object.freeze({
    nodeCode: 'A3043' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（兴趣爱好）",
    body: "对常见的问题进行解答\n\n家长尽量不要自己给孩子设置兴趣爱好，可以鼓励孩子过去尝试，选择自己的兴趣爱好\n\n如果孩子的兴趣爱好是“打游戏”怎么办？\n\n可以鼓励孩子参与一些竞技性的游戏，可以是任何游戏，不一定限于电脑游戏，可以延伸到生活中的竞技游戏。如果孩子一定要把游戏作为自己的爱好，那么一定要包含两个因素（之一）：一个是设计（比如学习编程)，另一个是竞技\n\n兴趣爱好和学习冲突怎么办？\n\n通常只是表面上的时间冲突，如果合理规划时间，还是可以平衡的。\n\n尽量避免让孩子因为学习放弃自己的兴趣爱好\n\n如果兴趣爱好需要花很多钱怎么办？\n\n家长在经济条件允许的情况下尽量满足孩子的兴趣爱好；不过经济条件不允许，帮助孩子培养其他爱好。不要用花钱支持孩子的兴趣爱好作为理由让孩子产生内疚感；也不要因为自己不能满足孩子的愿望而产生内疚感（很容易产生，需要自己调节）\n\n如果孩子有和别人攀比的情况，没有必要纵容他，但是一定要创造条件，让孩子在某一些方面比较突出，有一些成绩，产生自豪感",
  }),
  A3053: Object.freeze({
    nodeCode: 'A3053' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（家务）",
    body: "对常见的问题进行解答\n\n是否可以让孩子通过做家务来赚零花钱？\n\n可以。\n\n注意，第一要提前跟孩子商量好零花钱如何支配。\n\n2.  如果给孩子支付报酬，那么孩子做的家务一定是为整个家庭服务，也就是要帮别人做事情，如果只是洗自己的衣服收拾自己的房间，这些也可以算作做家务，但是不应该支付报酬\n\n    做家务是否可以作为一种惩罚措施，当孩子犯错的时候罚他做家务？\n\n    尽量避免把做家务当作惩罚措施，因为做家务的内在动机是助人和承担责任，如果把做家务当成惩罚，就会破坏这些内在动机。",
  }),
  A3063: Object.freeze({
    nodeCode: 'A3063' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（家庭聚会）",
    body: "对常见的问题进行解答\n\n不要把家庭聚会当成家庭教育动员大会，不要多个人同时来说教一个人，家庭聚会的时候可以暂时搁置平时的一些分歧，忘记平常的一些烦恼\n\n家庭聚会可以有一些仪式感，做一些与平时不同的事情，（比如在家庭聚会的时候，每个人都不要使用手机）\n\n不要在家庭聚会的时候做未来计划，可以是回顾过去，可以是每个人肯定其他人的优点，对其他人表示感谢，不要批评或抱怨\n\n可以用提供福利、提供奖品的方式把大家聚集起来\n\n尽量不要邀请客人",
  }),
  A3073: Object.freeze({
    nodeCode: 'A3073' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（外出活动）",
    body: "对常见的问题进行解答\n\n外出活动可以作为一种特殊的家庭聚会，原则是一样的\n\n如果孩子要单独外出活动怎么办？\n\n制订好计划和安全措施可以让孩子单独外出活动\n\n孩子单独外出时使用手机怎么办？\n\n需要和孩子建立相互信任感，这个问题在制订手机使用合约时会有解释\n\n**情绪调节1**\n\n这个任务要求家长和孩子配合一起来进行。适合家长和孩子之间偶尔有冲突，闹一些情绪，容易发脾气、冲动、不耐烦、焦虑等",
  }),
  A3083: Object.freeze({
    nodeCode: 'A3083' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（情绪调节1）",
    body: "对常见的问题进行解答\n\n情绪调节不仅仅是期待孩子做些什么，要同时有家长的参与\n\n“情绪问题”“负面情绪”这些说法都是为了沟通的需要，事实上情绪没有好坏之分，但是有程度的区别\n\n在肯定孩子表扬孩子的时候不要附带着对孩子提出期待或者要求，比如“希望你下次表现得更好”之类的\n\n对于青春期的孩子，不要当着外人夸他们，这会造成他们尴尬\n\n**时间管理。**",
  }),
  A3093: Object.freeze({
    nodeCode: 'A3093' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（时间管理）",
    body: "对常见的问题进行解答",
  }),
  A3103: Object.freeze({
    nodeCode: 'A3103' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（家庭关系）",
    body: "对常见的问题进行解答",
  }),
  A3113: Object.freeze({
    nodeCode: 'A3113' as const,
    contentVersion: FAMILY_ALLIANCE_CONTENT_VERSION,
    authorityDocument: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT,
    authorityDocumentVersion: FAMILY_ALLIANCE_AUTHORITY_DOCUMENT_VERSION,
    sourceBlob: FAMILY_ALLIANCE_AUTHORITY_SOURCE_BLOB,
    sectionHeading: "帮助选项（情绪调节2）",
    body: "对常见的问题进行解答\n\n关于自我成长：\n\n自我成长不等于我们通常所说的学习、自我提升或者认知提升。因为家长的自我成长不能只停留在任职的层面。因为家长也有情绪、也有压力，也有原生家庭带给自己的影响，如果家长不能处理好自己的这些问题，就很难帮助孩子处理这些问题。\n\n关于平等：\n\n每个人对于平等的理解不一样，家长天然地拥有更多权力，因此家长和孩子是不可能完全平等的。\n\n这里所说的平等主要是主要指的是在涉及到情绪调节这个问题的时候\n\n具体的原则是：我们在关于情绪进行沟通的时候，我既不会觉得自己比你更好，也不会觉得自己比你差，我既不会高高在上，也不会低你一等，我不是给你指导、给你命令，也不是对你怜悯，对你同情。我和你站在同一战线，我给你完全的理解和情感支持。\n\n目标可行性评估\n\n<table>\n<colgroup>\n<col style=\"width: 16%\" />\n<col style=\"width: 16%\" />\n<col style=\"width: 16%\" />\n<col style=\"width: 16%\" />\n<col style=\"width: 16%\" />\n<col style=\"width: 16%\" />\n</colgroup>\n<thead>\n<tr class=\"header\">\n<th>行为选项</th>\n<th>具体化/量化</th>\n<th>需求</th>\n<th>动机/获益</th>\n<th><p>能力/可能性</p>\n<p>（孩子的完成这个任务的能力）</p></th>\n<th>挑战/阻力</th>\n</tr>\n</thead>\n<tbody>\n<tr class=\"odd\">\n<td>问题行为：玩手机</td>\n<td>7-8小时</td>\n<td>自主性、娱乐性</td>\n<td><p>人际交往</p>\n<p>应对压力</p>\n<p>逃避学习</p></td>\n<td>轻松</td>\n<td>家长禁止</td>\n</tr>\n<tr class=\"even\">\n<td>目标替换行为：（此处的内容是用户初选的目标清单，包括必选项）</td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n</tr>\n<tr class=\"odd\">\n<td>睡眠</td>\n<td><p>每天多长时间</p>\n<p>几点到几点</p></td>\n<td><p>对上述需求的满足</p>\n<p>1-10 打一个分数（量尺的呈现形式）</p></td>\n<td><p>是否符合上述的动机</p>\n<p>1-10 打一个分数（量尺的呈现形式）</p></td>\n<td>对能力打一个分数</td>\n<td>对阻力打一个分数</td>\n</tr>\n<tr class=\"even\">\n<td>运动</td>\n<td>项目、频率</td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n</tr>\n<tr class=\"odd\">\n<td>兴趣爱好</td>\n<td>项目、从事的时间时间</td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n</tr>\n<tr class=\"even\">\n<td>家务</td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n</tr>\n<tr class=\"odd\">\n<td>家庭聚会</td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n</tr>\n<tr class=\"even\">\n<td>外出活动</td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n<td></td>\n</tr>\n</tbody>\n</table>\n\n可行性评估不再把所有项目放在同一个表里评估，而是每个项目逐一进行评估\n\n打分时，提示用户可以调整“具体化/量化”的时间然后重新打分\n\n打分完成以后，提示家长是否要进行目标清单的调整\n\n如不再调整，则保存目标清单",
  }),
} satisfies Record<FamilyAllianceContentNodeCode, FamilyAllianceContentAsset>);

export function resolveFamilyAllianceContent(
  nodeCode: string,
  contentVersion: string = FAMILY_ALLIANCE_CONTENT_VERSION
): FamilyAllianceContentAsset {
  if (contentVersion !== FAMILY_ALLIANCE_CONTENT_VERSION) {
    throw Object.assign(new Error('FAMILY_ALLIANCE_CONTENT_STALE'), {
      code: 'FAMILY_ALLIANCE_CONTENT_STALE',
    });
  }
  if (!FAMILY_ALLIANCE_CONTENT_NODE_CODES.includes(nodeCode as FamilyAllianceContentNodeCode)) {
    throw Object.assign(new Error('FAMILY_ALLIANCE_CONTENT_NOT_FOUND'), {
      code: 'FAMILY_ALLIANCE_CONTENT_NOT_FOUND',
    });
  }
  return FAMILY_ALLIANCE_CONTENT[nodeCode as FamilyAllianceContentNodeCode];
}
