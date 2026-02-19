install.packages(c("dplyr", "arrow", "remotes", "devtools"))
library(dplyr)
library(arrow)
remotes::install_github("abresler/nbastatR")
library(nbastatR)
devtools::install_github("josedv82/airball")
library(airball)
library(ggplot2)
library(maps)
la_travel_data <- nba_travel(start_season = 2017, end_season = 2018, team = c("Los Angeles Lakers"), return_home = 5, phase = "RS", flight_speed = 550)
la_travel_data <- la_travel_data %>%
  filter(!is.na(City), City != "") %>%
  select(
    Date,
    Team,
    City,
    Latitude,
    Longitude
  )
la_travel_data <- la_travel_data %>%
  arrange(Date)
la_travel_data <- la_travel_data %>%
  mutate(route_order = row_number())
library(maps)
library(ggplot2)
# Get US states for background
us_states <- map_data("state")
ggplot() +
  geom_polygon(
    data = us_states,
    aes(x = long, y = lat, group = group),
    fill = "gray90",
    color = "white"
  ) +
  geom_path(
    data = la_travel_data,
    aes(x = Longitude, y = Latitude),
    color = "blue",
    size = 1
  ) +
  geom_point(
    data = la_travel_data,
    aes(x = Longitude, y = Latitude),
    color = "red",
    size = 2
  ) +
  geom_text(
    data = la_travel_data,
    aes(x = Longitude, y = Latitude, label = route_order),
    vjust = -1,
    color = "black"
  ) +
  coord_fixed(1.3) +
  labs(
    title = paste("Travel Route for", "Los Angeles Lakers"),
    x = "Longitude",
    y = "Latitude"
  )
