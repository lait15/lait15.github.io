-- GameManager.lua
-- Script: ServerScriptService に配置
-- レース全体の管理（ラップ数・タイム・リーダーボード）

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TOTAL_LAPS = 3  -- 総ラップ数

-- RemoteEvent を作成（クライアントへの通知用）
local remotes = Instance.new("Folder")
remotes.Name  = "CarGameRemotes"
remotes.Parent = ReplicatedStorage

local evLapUpdate  = Instance.new("RemoteEvent")
evLapUpdate.Name   = "LapUpdate"
evLapUpdate.Parent = remotes

local evRaceFinish = Instance.new("RemoteEvent")
evRaceFinish.Name  = "RaceFinish"
evRaceFinish.Parent = remotes

-- プレイヤーごとのレースデータ
local raceData = {}  -- { [player] = { lap=0, checkpoints={}, startTime=0, bestLap=math.huge } }

local function initPlayer(player)
    raceData[player] = {
        lap         = 0,
        checkpoints = {},  -- 今のラップで通過したチェックポイントID一覧
        startTime   = os.clock(),
        lapStartTime= os.clock(),
        bestLap     = math.huge,
        finished    = false,
    }
end

local function formatTime(seconds)
    local m = math.floor(seconds / 60)
    local s = seconds % 60
    return string.format("%d:%05.2f", m, s)
end

-- チェックポイント通過をサーバーが受け取る RemoteEvent
local evCheckpoint = Instance.new("RemoteEvent")
evCheckpoint.Name  = "CheckpointPassed"
evCheckpoint.Parent = remotes

evCheckpoint.OnServerEvent:Connect(function(player, checkpointId, totalCheckpoints)
    local data = raceData[player]
    if not data or data.finished then return end

    -- 重複通過防止
    if table.find(data.checkpoints, checkpointId) then return end
    table.insert(data.checkpoints, checkpointId)

    -- 全チェックポイント通過でラップカウント
    if #data.checkpoints >= totalCheckpoints then
        data.lap += 1
        local lapTime = os.clock() - data.lapStartTime

        if lapTime < data.bestLap then
            data.bestLap = lapTime
        end

        data.checkpoints  = {}
        data.lapStartTime = os.clock()

        if data.lap >= TOTAL_LAPS then
            -- ゴール
            data.finished = true
            local totalTime = os.clock() - data.startTime
            evRaceFinish:FireClient(player, {
                totalTime = formatTime(totalTime),
                bestLap   = formatTime(data.bestLap),
                laps      = data.lap,
            })
        else
            -- ラップ通過通知
            evLapUpdate:FireClient(player, {
                lap      = data.lap,
                maxLap   = TOTAL_LAPS,
                lapTime  = formatTime(lapTime),
                bestLap  = formatTime(data.bestLap),
            })
        end

        -- リーダーボード更新
        local ls = player:FindFirstChild("leaderstats")
        if ls then
            local lapStat = ls:FindFirstChild("Laps")
            if lapStat then lapStat.Value = data.lap end
        end
    end
end)

-- プレイヤー参加時の初期化
Players.PlayerAdded:Connect(function(player)
    -- Leaderstats 作成
    local ls = Instance.new("Folder")
    ls.Name  = "leaderstats"
    ls.Parent = player

    local lapStat = Instance.new("IntValue")
    lapStat.Name  = "Laps"
    lapStat.Value = 0
    lapStat.Parent = ls

    -- キャラクター生成を待ってレース開始
    player.CharacterAdded:Connect(function()
        task.wait(2)  -- スポーン演出のため少し待つ
        initPlayer(player)
        evLapUpdate:FireClient(player, {
            lap     = 0,
            maxLap  = TOTAL_LAPS,
            lapTime = "0:00.00",
            bestLap = "--:--.--",
        })
    end)
end)

Players.PlayerRemoving:Connect(function(player)
    raceData[player] = nil
end)
