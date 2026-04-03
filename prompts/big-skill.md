
# BigQuery 工具名与参数（必读）

- 只读查询工具名：**`run_bigquery_sql`**（不要使用旧名 `query`，避免与「参数字段名」混淆）。
- 预估/校验工具名：**`dry_run_bigquery_sql`**（不要使用旧名 `dry_run_query`）。
- SQL 文本**必须**放在参数 **`sql`** 里；不要用 **`query`** 作为参数名（历史原因：旧工具名是 `query`，模型容易误用）。
- **传给 `run_bigquery_sql` / `dry_run_bigquery_sql` 的 SQL 禁止包含任何注释**（不要写行注释 `-- …`，也不要写块注释 `/* … */`）。服务端会检查整段字符串是否以 `SELECT` 开头；若以注释开头会报错 `Only SELECT queries are allowed.`。查询意图、字段说明请写在**回复正文**，不要写进 `sql` 参数。

# 时区问题

默认使用 UTC+8 中国时区。

# 查埋点、事件，数据库配置

- dateset：solvely-a3b82.analytics_365900100
- table：events*intraday*\*
- between：today

- period 表示周期（int 类型）
- 1：1 个月
- 3: 3 个月
- 7: 7 天
- 12: 12 个月

# 查订单、订阅、产品、用户等，数据库配置

- dateset：biblia-sagrada-consigo.solvely_mysql_migration
- table：
- 用户表：userInfo
- 订单表：orderWeb
- 订阅表：subscription
- 产品/价格表：productWeb
- between：today

# 查实验组

- dateset：biblia-sagrada-consigo.Solvely
- table: us_web_user

# 查 stripe

- dateset：solvely-warehouse.staging

新的 stripe：

- table：
  - 订阅表：staging_stripe_new_subscriptions_phi
  - 订阅详情表：staging_stripe_new_subscription_items_phi
  - 账单表：staging_stripe_new_invoices_phi
  - 客户表：staging_stripe_new_customers_phi
  - 支付表：staging_stripe_new_charges_phi

老的 stripe：

- table：

  - 订阅表：staging_stripe_subscriptions_phi
  - 订阅详情表：staging_stripe_subscription_items_phi
  - 账单表：staging_stripe_invoices_phi
  - 客户表：staging_stripe_customers_phi
  - 支付表：staging_stripe_charges_phi

- ios stripe:
  - product_id = ""

## 查邀请记录

- dateset：solvely-warehouse.dwd
- table：
  - 邀请人/邀请码：dwd_solvely_activity_invitatio
  - 被邀请人/邀请记录：dwd_solvely_invitation_record


# 详细的 BigQuery 表结构

> 时区：默认使用 UTC+8（中国时区）

---

## 一、埋点事件表

**Dataset**: `solvely-a3b82.analytics_365900100`  
**Table**: `events_intraday_*`（按日期分区，格式 `events_intraday_YYYYMMDD`）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| event_date | STRING | 事件日期（YYYYMMDD） |
| event_timestamp | INT64 | 事件时间戳（微秒） |
| event_name | STRING | 事件名称 |
| event_params | ARRAY\<STRUCT\<key STRING, value STRUCT\<string_value, int_value, float_value, double_value\>\>\> | 事件参数（KV 结构） |
| event_previous_timestamp | INT64 | 上一个事件时间戳 |
| event_value_in_usd | FLOAT64 | 事件价值（USD） |
| event_bundle_sequence_id | INT64 | 批次序号 |
| event_server_timestamp_offset | INT64 | 服务端时间戳偏移 |
| user_id | STRING | 用户 ID（登录后） |
| user_pseudo_id | STRING | 用户伪 ID（匿名标识） |
| privacy_info | STRUCT\<analytics_storage, ads_storage, uses_transient_token\> | 隐私信息 |
| user_properties | ARRAY\<STRUCT\<key STRING, value STRUCT\<..., set_timestamp_micros\>\>\> | 用户属性（KV 结构） |
| user_first_touch_timestamp | INT64 | 用户首次触达时间戳 |
| user_ltv | STRUCT\<revenue FLOAT64, currency STRING\> | 用户生命周期价值 |
| device | STRUCT\<category, mobile_brand_name, mobile_model_name, operating_system, operating_system_version, vendor_id, advertising_id, language, browser, browser_version, web_info...\> | 设备信息 |
| geo | STRUCT\<city, country, continent, region, sub_continent, metro\> | 地理位置 |
| app_info | STRUCT\<id, version, install_store, firebase_app_id, install_source\> | App 信息 |
| traffic_source | STRUCT\<name, medium, source\> | 流量来源 |
| stream_id | STRING | 数据流 ID |
| platform | STRING | 平台（web / iOS / Android） |
| event_dimensions | STRUCT\<hostname STRING\> | 事件维度 |
| ecommerce | STRUCT\<total_item_quantity, purchase_revenue_in_usd, purchase_revenue, refund_value_in_usd, refund_value, transaction_id...\> | 电商信息 |
| items | ARRAY\<STRUCT\<item_id, item_name, item_brand, item_category, price_in_usd, price, quantity, item_revenue...\>\> | 商品列表 |
| collected_traffic_source | STRUCT\<manual_campaign_id, manual_campaign_name, manual_source, manual_medium, gclid, dclid...\> | 采集流量来源 |
| is_active_user | BOOL | 是否活跃用户 |
| batch_event_index | INT64 | 批次事件索引 |
| batch_page_id | INT64 | 批次页面 ID |
| batch_ordering_id | INT64 | 批次排序 ID |
| session_traffic_source_last_click | STRUCT\<manual_campaign, google_ads_campaign, cross_channel_campaign...\> | 会话最后点击来源 |
| publisher | STRUCT\<ad_revenue_in_usd, ad_format, ad_source_name, ad_unit_id\> | 广告发布信息 |

**查询示例**：
```sql
FROM `solvely-a3b82.analytics_365900100.events_intraday_*`
WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', DATE(TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)))
```

---

## 二、业务表

**Dataset**: `biblia-sagrada-consigo.solvely_mysql_migration`

### 2.1 用户表 `userInfo`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER | 主键 |
| deviceId | STRING | 设备 ID（用户唯一标识） |
| role | FLOAT | 用户角色（0=匿名，1=注册用户） |
| userName | STRING | 用户名 |
| email | STRING | 邮箱 |
| password | STRING | 密码 |
| appVersion | STRING | App 版本 |
| system | STRING | 系统（Android / iOS / web） |
| appleAppId | STRING | Apple App ID |
| adjustUserId | STRING | Adjust 用户 ID |
| idfa | STRING | iOS 广告标识 |
| idfv | STRING | iOS 厂商标识 |
| country | STRING | 国家代码 |
| pushToken | STRING | 推送 Token |
| createTime | DATETIME | 创建时间 |
| updateTime | DATETIME | 更新时间 |
| deleteTime | DATETIME | 删除时间 |
| userPicture | STRING | 头像 URL |
| isSigned | INTEGER | 是否已登录（1=是） |
| loginType | STRING | 登录方式（google / apple / email / custom / anonymous） |
| isReceive | INTEGER | 是否接收推送 |
| gpsAdid | STRING | Android 广告 ID |
| grade | STRING | 年级（highSchool / university / middleSchool / others） |
| webPushToken | STRING | Web 推送 Token |
| webAdjustUserId | STRING | Web Adjust 用户 ID |
| subject | STRING | 学科 |
| marketingType | INTEGER | 营销类型（1=SEM，2=iOS） |
| fromDeviceId | STRING | 匿名转正式账户时原匿名账户的 deviceId |
| isAnonymous | INTEGER | 是否匿名用户（0=否，1=是） |
| identity | STRING | 用户身份（安卓使用） |
| source | STRING | 注册来源（SEM / web / plugin_sem 等） |
| userPseudoId | STRING | Firebase 伪用户 ID |

### 2.2 订单表 `orderWeb`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER | 主键 |
| deviceId | STRING | 设备 ID |
| originalTransactionId | STRING | 原始订单 ID |
| transactionId | STRING | 订阅订单特有 ID |
| purchaseChannel | STRING | 购买渠道（stripe / appstore / huawei） |
| currency | STRING | 币种（usd 等） |
| mode | STRING | 订单类型（payment=消耗品，subscription=订阅） |
| purchaseTimeStamp | INTEGER | 交易时间戳（毫秒） |
| productId | STRING | 产品 ID |
| quantity | INTEGER | 购买数量 |
| period | INTEGER | 订阅周期（1=1个月，3=3个月，7=7天，12=12个月） |
| amount | INTEGER | 金额（单位：分） |
| diamond | INTEGER | 钻石数量 |
| status | STRING | 订单状态（open / complete） |
| refund | INTEGER | 是否退款（1=已退款，0=未退款） |
| regular | INTEGER | 是否入金（1=已入金，0=未入金） |
| createdRaw | STRING | 创建订单的 Stripe Session 原始数据 |
| completedRaw | STRING | 订单完成的 Webhook 原始数据 |
| environment | STRING | 环境标识（Production / Sandbox） |
| customer | STRING | Stripe 客户 ID |
| invoice | STRING | Stripe 账单 ID |
| createTime | DATETIME | 创建时间 |
| updateTime | DATETIME | 更新时间 |
| deleteTime | DATETIME | 删除时间 |
| isTrial | INTEGER | 是否试用期（1=是） |
| priceId | STRING | Stripe 价格 ID |
| version | INTEGER | 版本号 |
| source | STRING | 来源（ios / web 等） |

### 2.3 订阅表 `subscription`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER | 主键 |
| deviceId | STRING | 设备 ID / 用户 ID |
| originalTransactionId | STRING | 原始订单 ID |
| transactionId | STRING | 订阅 ID（Stripe sub_xxx） |
| productId | STRING | 产品 ID |
| bundleId | STRING | 平台标识（stripe / com.mathsolvenow.panda 等） |
| refund | INTEGER | 是否退款（1=是，0=否） |
| regular | INTEGER | 是否入金（1=是，0=否） |
| expired | INTEGER | 是否过期（1=是，0=否） |
| isCancel | INTEGER | 是否已取消（1=是，0=否） |
| period | INTEGER | 订阅周期（1=1个月，3=3个月，7=7天，12=12个月） |
| grantGems | INTEGER | 赠送钻石数 |
| nextGrantGemsTime | INTEGER | 下次赠送钻石时间 |
| hasUnredeemedGems | INTEGER | 是否有未领取钻石 |
| redeemGems | INTEGER | 已领取钻石数 |
| purchaseTimeStamp | INTEGER | 购买时间戳（毫秒） |
| expireTimeStamp | INTEGER | 到期时间戳（毫秒） |
| environment | STRING | 环境标识（Production / Sandbox） |
| createTime | TIMESTAMP | 创建时间 |
| updateTime | TIMESTAMP | 更新时间 |
| isTrialPeriod | INTEGER | 是否试用期（1=是） |
| subscriptionType | INTEGER | 订阅类型（1=solver，2=writer，3=solver+writer bundle，4=其他） |
| deleteTime | TIMESTAMP | 删除时间 |

---

## 三、实验组表

**Dataset**: `biblia-sagrada-consigo.Solvely`  
**Table**: `us_web_user`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| user_id | STRING | 用户 ID（deviceId） |
| event_name | STRING | 实验名称（如 TEST_AIO_CTA_A / TEST_AIO_CTA_B） |
| event_time | TIMESTAMP | 进入实验时间 |
| event_date | DATE | 进入实验日期 |

---

## 四、Stripe 新表（优先使用）

**Dataset**: `solvely-warehouse.staging`

### 4.1 订阅表 `staging_stripe_new_subscriptions_phi`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | STRING | Stripe 订阅 ID（sub_xxx） |
| customer_id | STRING | Stripe 客户 ID（cus_xxx） |
| status | STRING | 订阅状态（active / canceled / trialing / past_due / unpaid） |
| created | TIMESTAMP | 创建时间 |
| start | TIMESTAMP | 订阅开始时间 |
| start_date | TIMESTAMP | 订阅开始日期 |
| current_period_start | TIMESTAMP | 当前周期开始时间 |
| current_period_end | TIMESTAMP | 当前周期结束时间 |
| cancel_at | TIMESTAMP | 预计取消时间 |
| cancel_at_period_end | BOOL | 是否在周期结束时取消 |
| canceled_at | TIMESTAMP | 实际取消时间 |
| cancellation_details_comment | STRING | 取消备注 |
| cancellation_details_feedback | STRING | 取消反馈 |
| cancellation_details_reason | STRING | 取消原因 |
| ended_at | TIMESTAMP | 订阅结束时间 |
| trial_start | TIMESTAMP | 试用开始时间 |
| trial_end | TIMESTAMP | 试用结束时间 |
| plan_id | STRING | 计划 ID |
| price_id | STRING | 价格 ID |
| quantity | INT64 | 数量 |
| latest_invoice_id | STRING | 最新账单 ID |
| billing_cycle_anchor | TIMESTAMP | 计费周期锚点 |
| default_payment_method_id | STRING | 默认支付方式 ID |
| discount_coupon_id | STRING | 优惠券 ID |
| discount_start | TIMESTAMP | 折扣开始时间 |
| discount_end | TIMESTAMP | 折扣结束时间 |
| application_fee_percent | FLOAT64 | 应用费用比例 |
| tax_percent | FLOAT64 | 税率 |
| merchant_id | STRING | 商户 ID |
| batch_timestamp | TIMESTAMP | 数据同步时间 |
| _created_at | TIMESTAMP | 数据入库时间 |

### 4.2 订阅详情表 `staging_stripe_new_subscription_items_phi`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | STRING | 订阅项 ID |
| subscription / subscription_id | STRING | 所属订阅 ID |
| plan_id | STRING | 计划 ID |
| plan_amount | INT64 | 计划金额（单位：分） |
| plan_currency | STRING | 货币 |
| plan_interval | STRING | 计费周期（month / week / year） |
| plan_interval_count | INT64 | 计费周期数量 |
| plan_nickname | STRING | 计划别名 |
| plan_product_id | STRING | 产品 ID |
| plan_trial_period_days | INT64 | 试用天数 |
| plan_created | TIMESTAMP | 计划创建时间 |
| price_id | STRING | 价格 ID |
| price_unit_amount | INT64 | 单价（单位：分） |
| price_currency | STRING | 货币 |
| price_product_id | STRING | 产品 ID |
| price_nickname | STRING | 价格别名 |
| price_recurring_interval | STRING | 价格周期 |
| price_recurring_interval_count | INT64 | 价格周期数量 |
| price_recurring_trial_period_days | INT64 | 价格试用天数 |
| price_created | TIMESTAMP | 价格创建时间 |
| quantity | INT64 | 数量 |
| created | INT64 | 创建时间戳 |
| discounts | STRING | 折扣信息 |
| merchant_id | STRING | 商户 ID |
| batch_timestamp | TIMESTAMP | 数据同步时间 |
| _created_at | TIMESTAMP | 数据入库时间 |

### 4.3 账单表 `staging_stripe_new_invoices_phi`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | STRING | 账单 ID（in_xxx） |
| customer_id | STRING | 客户 ID |
| customer_email | STRING | 客户邮箱 |
| customer_name | STRING | 客户姓名 |
| subscription_id | STRING | 订阅 ID |
| charge_id | STRING | 支付 ID |
| status | STRING | 账单状态（paid / open / void / uncollectible） |
| paid | BOOL | 是否已支付 |
| paid_out_of_band | BOOL | 是否带外支付 |
| currency | STRING | 货币 |
| amount_due | INT64 | 应付金额（单位：分） |
| amount_paid | INT64 | 已付金额（单位：分） |
| amount_remaining | INT64 | 剩余金额（单位：分） |
| subtotal | INT64 | 小计（单位：分） |
| total | INT64 | 总计（单位：分） |
| tax | INT64 | 税额（单位：分） |
| tax_percent | FLOAT64 | 税率 |
| date | TIMESTAMP | 账单日期 |
| due_date | TIMESTAMP | 到期日 |
| period_start | TIMESTAMP | 账单周期开始 |
| period_end | TIMESTAMP | 账单周期结束 |
| effective_at | TIMESTAMP | 生效时间 |
| billing_reason | STRING | 计费原因（subscription_create / subscription_cycle 等） |
| collection_method | STRING | 收款方式 |
| attempt_count | INT64 | 支付尝试次数 |
| attempted | BOOL | 是否已尝试支付 |
| auto_advance | BOOL | 是否自动推进 |
| number | STRING | 账单编号 |
| receipt_number | STRING | 收据编号 |
| discount_coupon_id | STRING | 优惠券 ID |
| default_payment_method_id | STRING | 默认支付方式 |
| status_transitions_finalized_at | TIMESTAMP | 定稿时间 |
| status_transitions_paid_at | TIMESTAMP | 支付时间 |
| status_transitions_voided_at | TIMESTAMP | 作废时间 |
| merchant_id | STRING | 商户 ID |
| batch_timestamp | TIMESTAMP | 数据同步时间 |
| _created_at | TIMESTAMP | 数据入库时间 |

### 4.4 客户表 `staging_stripe_new_customers_phi`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | STRING | Stripe 客户 ID（cus_xxx） |
| email | STRING | 客户邮箱 |
| name | STRING | 客户姓名 |
| phone | STRING | 电话 |
| created | TIMESTAMP | 创建时间 |
| balance | INT64 | 账户余额（单位：分） |
| account_balance | INT64 | 账户余额（旧字段） |
| currency | STRING | 默认货币 |
| deleted | BOOL | 是否已删除 |
| delinquent | BOOL | 是否欠款 |
| description | STRING | 描述 |
| default_source_id | STRING | 默认支付来源 ID |
| invoice_settings_default_payment_method_id | STRING | 账单默认支付方式 |
| tax_exempt | STRING | 税务豁免状态 |
| discount_coupon_id | STRING | 优惠券 ID |
| discount_start | TIMESTAMP | 折扣开始时间 |
| discount_end | TIMESTAMP | 折扣结束时间 |
| address_city | STRING | 城市 |
| address_country | STRING | 国家 |
| address_line1 | STRING | 地址行 1 |
| address_postal_code | STRING | 邮编 |
| address_state | STRING | 州/省 |
| merchant_id | STRING | 商户 ID |
| batch_timestamp | TIMESTAMP | 数据同步时间 |
| _created_at | TIMESTAMP | 数据入库时间 |

### 4.5 支付表 `staging_stripe_new_charges_phi`

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | STRING | 支付 ID（ch_xxx） |
| customer_id | STRING | 客户 ID |
| invoice_id | STRING | 账单 ID |
| payment_intent | STRING | 支付意图 ID |
| payment_method_id | STRING | 支付方式 ID |
| payment_method_type | STRING | 支付方式类型（card 等） |
| amount | INT64 | 支付金额（单位：分） |
| amount_refunded | INT64 | 退款金额（单位：分） |
| currency | STRING | 货币 |
| status | STRING | 支付状态（succeeded / failed / pending） |
| paid | BOOL | 是否已支付 |
| refunded | BOOL | 是否已退款 |
| captured | BOOL | 是否已捕获 |
| captured_at | TIMESTAMP | 捕获时间 |
| created | TIMESTAMP | 创建时间 |
| description | STRING | 描述 |
| receipt_email | STRING | 收据邮箱 |
| receipt_number | STRING | 收据编号 |
| card_brand | STRING | 卡品牌（Visa / Mastercard 等） |
| card_country | STRING | 发卡国家 |
| card_last4 | STRING | 卡号后四位 |
| card_exp_month | INT64 | 卡有效期月 |
| card_exp_year | INT64 | 卡有效期年 |
| card_funding | STRING | 卡类型（credit / debit） |
| card_fingerprint | STRING | 卡指纹 |
| outcome_type | STRING | 结果类型（authorized / blocked 等） |
| outcome_risk_level | STRING | 风险等级 |
| outcome_risk_score | INT64 | 风险评分 |
| outcome_network_status | STRING | 网络状态 |
| failure_code | STRING | 失败代码 |
| failure_message | STRING | 失败原因 |
| balance_transaction_id | STRING | 余额交易 ID |
| statement_descriptor | STRING | 账单描述 |
| merchant_id | STRING | 商户 ID |
| batch_timestamp | TIMESTAMP | 数据同步时间 |
| _created_at | TIMESTAMP | 数据入库时间 |
