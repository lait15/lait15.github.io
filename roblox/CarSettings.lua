-- CarSettings.lua
-- ModuleScript: ReplicatedStorage に配置
-- 全パラメータを一元管理。拡張はテーブルへの追記のみ。

local CarSettings = {}

-- ============================================================
-- 【車種テーブル】 新車種追加：ここに1エントリ追加するだけ
--   Ability: "Boost" | "EMP" | "Heal" | "Water"
--   RequiresGamePass: Game Pass フラグ名（省略で誰でも選択可）
-- ============================================================
CarSettings.Vehicles = {

    Normal = {
        DisplayName     = "普通の車",
        MaxSpeed        = 80,
        Acceleration    = 15,
        TurnSpeed       = 3.5,
        HP              = 100,
        BoostMultiplier = 1.8,
        BoostDuration   = 3,
        BoostCooldown   = 5,
        Ability         = "Boost",
        AbilityCooldown = 5,
        Color           = "Bright red",
        HasSiren        = false,
    },

    Police = {
        DisplayName     = "パトカー",
        MaxSpeed        = 75,
        Acceleration    = 14,
        TurnSpeed       = 3.2,
        HP              = 120,
        BoostMultiplier = 1.5,
        BoostDuration   = 2,
        BoostCooldown   = 6,
        Ability         = "EMP",
        AbilityCooldown = 12,
        EMPRadius       = 20,   -- EMP の有効半径（スタッド）
        EMPDuration     = 3,    -- 停止させる秒数
        Color           = "Bright blue",
        HasSiren        = true,
    },

    Ambulance = {
        DisplayName     = "救急車",
        MaxSpeed        = 65,
        Acceleration    = 12,
        TurnSpeed       = 3.0,
        HP              = 150,
        BoostMultiplier = 1.4,
        BoostDuration   = 2,
        BoostCooldown   = 7,
        Ability         = "Heal",
        AbilityCooldown = 15,
        HealAmount      = 40,   -- 回復量
        Color           = "White",
        HasSiren        = true,
    },

    Fire = {
        DisplayName     = "消防車",
        MaxSpeed        = 60,
        Acceleration    = 11,
        TurnSpeed       = 2.8,
        HP              = 180,
        BoostMultiplier = 1.3,
        BoostDuration   = 2,
        BoostCooldown   = 8,
        Ability         = "Water",
        AbilityCooldown = 8,
        WaterRange      = 25,   -- 放水の射程（スタッド）
        WaterDamage     = 15,   -- 放水ダメージ
        WaterSlowAmount = 0.5,  -- スロー係数（0.5 = 速度50%減）
        WaterDuration   = 3,    -- スロー持続秒数
        Color           = "Bright red",
        HasSiren        = true,
    },

    -- VIPカー（Game Pass 所持者専用）
    VIP = {
        DisplayName      = "VIPカー",
        MaxSpeed         = 100,
        Acceleration     = 20,
        TurnSpeed        = 4.0,
        HP               = 120,
        BoostMultiplier  = 2.0,
        BoostDuration    = 4,
        BoostCooldown    = 4,
        Ability          = "Boost",
        AbilityCooldown  = 4,
        Color            = "Gold",
        HasSiren         = false,
        RequiresGamePass = "hasVIPCar",  -- MonetizationManager が付与するフラグ名
    },

    -- ↑ 新車種をここに追加
}

-- ============================================================
-- 【マップリスト】
--   Workspace/Maps/[MapName] フォルダを作成し、名前をここに追加
-- ============================================================
CarSettings.Maps = { "City", "Desert", "Factory" }

-- ============================================================
-- 【パワーアップアイテム】 新アイテム：ここに1行追加
--   effect: "speed" | "shield" | "aoe"
-- ============================================================
CarSettings.Items = {
    SpeedPad = { effect = "speed",  duration = 5,  multiplier  = 1.5  },
    Shield   = { effect = "shield", duration = 8,  damageBlock = 0.5  },
    Bomb     = { effect = "aoe",    radius   = 15, damage      = 40   },
    -- ↑ 新アイテムをここに追加
}

CarSettings.ItemSpawnCount   = 10   -- マップ上に同時存在するアイテム数
CarSettings.ItemRespawnDelay = 15   -- アイテム取得後の再出現時間（秒）

-- ============================================================
-- 衝突ダメージ設定
-- ============================================================
CarSettings.CollisionSpeedThreshold   = 10   -- この速度差(スタッド/秒)以上でダメージ
CarSettings.CollisionDamageMultiplier = 0.8  -- 速度差 × この値 = ダメージ量

-- ============================================================
-- リスポーン設定
-- ============================================================
CarSettings.RespawnDelay  = 4    -- 爆発からリスポーンまでの秒数
CarSettings.FlipThreshold = 60   -- 転倒判定角度（度）
CarSettings.FlipTimer     = 2    -- 転倒継続でリスポーン待機秒数

-- ============================================================
-- ドリフト設定
-- ============================================================
CarSettings.DriftFriction     = 0.3  -- 横方向摩擦係数（低いほど滑る）
CarSettings.DriftCoinInterval = 1    -- ドリフト何秒ごとにコイン付与
CarSettings.DriftCoinAmount   = 5    -- 1インターバルで得るコイン量

-- ============================================================
-- コイン設定
-- ============================================================
CarSettings.KillCoin = 20   -- キル1回で得るコイン

-- ============================================================
-- カメラ設定
-- ============================================================
CarSettings.CameraDistance = 18
CarSettings.CameraHeight   = 6

return CarSettings
