install.packages(c("dplyr", "arrow", "remotes", "devtools"))
library(dplyr)
library(arrow)
remotes::install_github("abresler/nbastatR")
library(nbastatR)
devtools::install_github("josedv82/airball")
library(airball)
library(ggplot2)
library(maps)
# All NBA games 2014-2019 travel data
nba_travel_data <- nba_travel(start_season = 2014, end_season = 2019, return_home = 5, phase = "RS", flight_speed = 550)
nba_travel_data <- nba_travel_data %>%
  filter(!is.na(City), City != "") %>%
  filter(!is.na(Longitude), !is.na(Latitude)) %>%
  distinct(Date, City, Latitude, Longitude, .keep_all = TRUE)
nba_travel_data <- nba_travel_data %>%
  arrange(Date)
nba_travel_data <- nba_travel_data %>%
  mutate(route_order = row_number())
# Box scores from those gamess
team_box <- game_logs( 
  seasons = 2014:2019,
  result_types = "team"
)
# rename attributes and add ORTG
nba_sched <- team_box %>%
  transmute(
    season      = slugSeason,
    date        = dateGame,
    game_id     = as.character(idGame),
    team        = slugTeam,          # e.g., "LAL"
    team_name   = nameTeam,
    opponent    = slugOpponent,      # e.g., "BOS"
    home_away   = locationGame,      # "Home"/"Away"
    rest_days   = countDaysRestTeam,
    isWin       = isWin,
    pts         = ptsTeam,
    oppPts      = ptsTeam - plusminusTeam,
    fga         = fgaTeam,
    fta         = ftaTeam,
    oreb        = orebTeam,
    tov         = tovTeam
  ) %>%
  mutate(
    poss = fga + 0.44 * fta - oreb + tov,
    ortg = 100 * pts / poss
  )
# rename attributes for travel data
nba_travel <- nba_travel_data %>%
  transmute(
    season    = Season,
    date      = Date,
    team_name = Team,                # full name in airball
    travel_miles = as.numeric(Distance[,1]),
    tz_shift_hrs = as.numeric(`Shift (hrs)`[,1]),
    tz_dir       = `Direction (E/W)`[,1],
    city         = City,
    lat          = Latitude,
    lon          = Longitude
  )
nba_sched_final <- nba_sched %>%
  left_join(nba_travel, by = c("season", "date", "team_name"))
# load travel data from Lakers 2017-2018 season
la_travel_data <- nba_travel(start_season = 2018, end_season = 2018, team = c("Los Angeles Lakers"), return_home = 5, phase = "RS", flight_speed = 550)
la_travel_data <- la_travel_data %>%
  filter(!is.na(City), City != "") %>%
  filter(!is.na(Longitude), !is.na(Latitude)) %>%
  distinct(Date, City, Latitude, Longitude, .keep_all = TRUE)
la_travel_data <- la_travel_data %>%
  arrange(Date)
la_travel_data <- la_travel_data %>%
  mutate(route_order = row_number())
# after loading and cleaning write to csv so that React.js can access
write.csv(
  la_travel_data[, c("Date","City","Latitude","Longitude")],
  "route.csv",
  row.names = FALSE
)
# LOAD TEAM BOX SCORE FOR LAKERS
team_box <- game_logs(
  seasons = 2018,
  result_types = "team"
)
lakers_2018 <- team_box %>%
  filter(slugTeam == "LAL")
# rename attributes and add ORTG
sched <- lakers_2018 %>%
  transmute(
    season      = slugSeason,
    date        = dateGame,
    game_id     = as.character(idGame),
    team        = slugTeam,          # e.g., "LAL"
    team_name   = nameTeam,
    oppo ent    = slugOpponent,      # e.g., "BOS"
    home_away   = locationGame,      # "Home"/"Away"
    rest_days   = countDaysRestTeam,
    isWin       = isWin,
    pts         = ptsTeam,
    oppPts      = ptsTeam - plusminusTeam,
    fga         = fgaTeam,
    fta         = ftaTeam,
    oreb        = orebTeam,
    tov         = tovTeam
  ) %>%
  mutate(
    poss = fga + 0.44 * fta - oreb + tov,
    ortg = 100 * pts / poss
  )
# rename attributes for travel data
travel <- la_travel_data %>%
  transmute(
    season    = Season,
    date      = Date,
    team_name = Team,                # full name in airball
    travel_miles = as.numeric(Distance[,1]),
    tz_shift_hrs = as.numeric(`Shift (hrs)`[,1]),
    tz_dir       = `Direction (E/W)`[,1],
    city         = City,
    lat          = Latitude,
    lon          = Longitude
  )
sched_final <- sched %>%
  left_join(travel, by = c("season", "date", "team_name"))
# create to and from coordinates for the arcs
arcs_travel <- sched_final %>% 
  group_by(season, team) %>%
  mutate(
    from_lat = lag(lat),
    from_lon = lag(lon),
    to_lat   = lat,
    to_lon   = lon
  ) %>%
  ungroup() %>%
  filter(!is.na(from_lat), !is.na(from_lon))
arcs_out <- arcs_travel %>%
  transmute(
    season,
    date = as.character(date),
    game_id,
    team, team_name,
    opponent,
    from_lon, from_lat,
    to_lon, to_lat,
    home_away,
    isWin, pts, opp_pts, ortg,
    rest_days, travel_miles, tz_shift_hrs, tz_dir
  )
write_json(arcs_travel, "travel_arcs.json",
           pretty = TRUE, auto_unbox = TRUE)