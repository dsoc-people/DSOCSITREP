#!python3
# -*- coding: utf-8 -*-
import os, sys
from PyQt5.QtCore import *
from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5 import QtCore as qtcore
from PyQt5.QtCore import QVariant
from PyQt5 import QtGui
from datetime import datetime, timedelta
import calendar
import time
#import urllib.request
import urllib
import urllib.request
import socket
import traceback
import re
import textwrap
import os
import requests
import ssl
from PIL import Image
import shutil
import tarfile
from zipfile import ZipFile
import zipfile
import gzip
import shutil
import subprocess
#Import GIS
from qgis.gui import *
from qgis.PyQt.QtWidgets import QAction
from qgis.PyQt.QtCore import Qt
from qgis.gui import QgsRubberBand
from qgis.utils import *
from qgis.core import *
from qgis.analysis import QgsRasterCalculatorEntry, QgsRasterCalculator
from qgis.PyQt.QtGui import (
    QColor,
)

from qgis.PyQt.QtCore import Qt, QRectF

from qgis.core import (
    QgsVectorLayer,
    QgsPoint,
    QgsPointXY,
    QgsProject,
    QgsGeometry,
    QgsMapRendererJob,
    QgsRasterLayer,
    QgsDistanceArea,
)

from qgis.gui import (
    QgsMapCanvas,
    QgsVertexMarker,
    QgsMapCanvasItem,
    QgsRubberBand,
)

###############################################################################################################################################################################
#
#           WKU SA GUI
#
#           update list:
#          File paths , dsoc.png
#           
#           
#
#           
#           
#           
#
#
#############################################################################################################################################################################

class SAGUI(QMainWindow):
    def __init__(self, parent = None):
        super(SAGUI, self).__init__(parent)
        self.config()
        self.setWindowTitle("WKU GUI")
        #self.setWindowIcon(QtGui.QIcon(self.iconpath + 'dsoc.png'))
        
        self.siteswx=[["", '', '--', '--', '--', '--', '--', '--','--',None,"",'--']]
        self.siteswxcount=len(self.siteswx)-1
        self.sitewxpos=0
        self.setGeometry(0,0,1920,1060)#(int x, int y, int w, int h)
        self.setStyleSheet('background-color: rgb(45,45,45)')
        
        self.vfricon=QPixmap(self.iconpath + 'VFR.png')#.scaledToWidth(30)
        self.vfricon=self.vfricon.scaled(45,45, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.mvfricon=QPixmap(self.iconpath + 'MVFR.png')#.scaledToWidth(30)
        self.mvfricon=self.mvfricon.scaled(55,55, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.ifricon=QPixmap(self.iconpath + 'IFR.png')#.scaledToWidth(30)
        self.ifricon=self.ifricon.scaled(45,45, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.lifricon=QPixmap(self.iconpath + 'LIFR.png')#.scaledToWidth(30)
        self.lifricon=self.lifricon.scaled(45,45, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.downloadicon=QPixmap(self.iconpath + 'Download.png')#.scaledToWidth(40)
        self.downloadicon=self.downloadicon.scaled(40,40, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.nodownloadicon=QPixmap(self.iconpath + 'NoDownload.png')#.scaledToWidth(40)
        self.nodownloadicon=self.nodownloadicon.scaled(40,40, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.erroricon=QPixmap(self.iconpath + 'ErrorIcon.png')#.scaledToWidth(50)
        self.erroricon=self.erroricon.scaled(55,55, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        
        #Build the frames within the main frame
        self.buildtimeFrame()
        self.buildlogoFrame()
        self.buildwarningFrame()
        self.buildwatchFrame()
        self.buildadvisoryFrame()
        self.buildcurrentwxFrame()
        self.buildGISFrame()
        
        #Set time timer
        self.timer=QTimer(self)
        self.timer.timeout.connect(self.time)
        self.timer.start(1000)
        
        #Set wx timer
        self.wxtimer=QTimer(self)
        self.wxtimer.timeout.connect(self.changecurrentwx)
        self.wxtimer.start(10000)
        
        #Start the wx thread
        self.getDTTempThread=GetDTTemp(self.temperaturesite)
        self.getDTTempThread.singnal.connect(self.updateDTTemp)
        self.getDTTempThread.start()
        
        #Set up current wx thread
        self.tafsites=[]
        self.getcurrentwxThread=GetCurrentWX(self.wxsites, self.tafsites,self.utcoffsetdaylight,self.utcoffsetstandard)
        self.getcurrentwxThread.singnal.connect(self.updatecurrentwx)
        
        #Set up warning thread
        self.errorwarning=0
        self.warnings=['NA']
        self.warningcount=len(self.warnings)-1
        self.warningpos=0
        self.warningcountlabel=['NA']
        self.watches=['NA']
        self.watchcount=len(self.watches)-1
        self.watchpos=0
        self.watchcountlabel=['NA']
        self.advisories=['NA']
        self.advisorycount=len(self.advisories)-1
        self.advisorypos=0
        self.advisorycountlabel=['NA']
        self.getWarningDataThread=GetWarnings(self.zones)
        self.getWarningDataThread.singnal.connect(self.updatewarningdata)
        self.getWarningDataThread.start()
        self.warningtimer=QTimer(self)
        self.warningtimer.timeout.connect(self.changewarningdata)
        self.warningtimer.start(5000)
        
        self.startup=1
        self.gisthreadcount=0
        self.getGISThread=GetGISData(self.startup,self.canvas, self.GISpath, self.folderpath)
        self.getGISThread.singnal.connect(self.updateGIS)
        self.getGISThread.start()
        self.nodownloadlabel.hide()
        self.downloadlabel.show()
        
    def config(self):
        self.folderpath="C:\\Users\\thm16812\\Documents\\WKU\\"
        #No need to set these
        self.iconpath=self.folderpath + "Icons\\"
        self.GISpath=self.folderpath + "GIS\\"
        #List obs you would like to see displayed, must be the 4 letter id  
        self.wxsites=["KBWG","KBNA"]
        #County or zone numbers you want WWA for
        self.zones=['KYC021']
        #Temperature to be diplayed with the time
        self.temperaturesite='KBWG'
        #utc offset in daylight time
        self.utcoffsetdaylight=-5
        #utc offset in standard time
        self.utcoffsetstandard=-6
        
    def updateicons(self):
        iconlist=['Roads\\RoadsStyle.qml','Outlooks\\SPC\\Convective\\LSRStyle.qml','RFC\\RiverStyle.qml']
        for stylefile in iconlist:
            f=open(self.GISpath+stylefile,'r')
            data=f.readlines()
            f.close()
            f=open(self.GISpath+stylefile,'w')
            try:
                for i in data:
                    if "imageFile" in i:
                        oldpath=re.split('" ',re.split('value="',i)[1])[0].replace('/>','').replace('\n','').replace('"','')
                        iconname=re.split('\/',oldpath)
                        iconname=iconname[len(iconname)-1]
                        f.write(i.replace(oldpath,self.iconpath.replace("\\",'/') + iconname))                    
                    else:
                        f.write(i)
            except:
                pass
            f.close()
        
    def time(self):
        self.daylightsaving()
        self.addhour = datetime.utcnow() + timedelta(hours=self.lautcoffset)
        self.localtime12.setText(format(self.addhour, '%I:%M'))
        self.localseconds.setText(format(self.addhour, '%p \n%S'))
        self.localtime24.setText(format(self.addhour, '%A %B %d, %Y %H:%M'))
        self.utctime.setText(time.strftime('%H:%M:%S', time.gmtime()))
        self.utcdate.setText(time.strftime('%A %B %d, %Y %I:%M %p', time.gmtime()))
        self.min=time.strftime('%M%S', time.gmtime())
        #Update the radar loop of images and warnings (every 5 min)
        if self.min.endswith("000") or self.min.endswith("500"):
            if self.getDTTempThread.isRunning():
                pass
            else:
                self.getDTTempThread.start()
            if self.getWarningDataThread.isRunning():
                pass
            else:
                self.getWarningDataThread.start()
            if self.getGISThread.isRunning():
                pass
            else:
                self.startup=0
                self.getGISThread=GetGISData(self.startup,self.canvas, self.GISpath, self.folderpath)
                self.getGISThread.singnal.connect(self.updateGIS)
                self.getGISThread.start()
                self.nodownloadlabel.hide()
                self.downloadlabel.show()
        self.gisthreadcount=self.gisthreadcount+1           
        if self.gisthreadcount==600:
            text="Multiple layers may be outdated"
            self.GISerrorlabel.setText(text)
            self.GISerrorWindow.show()
        
    def daylightsaving(self):
        #LA
        if datetime.utcnow()>datetime.strptime("3/"+str(calendar.monthcalendar(int(format(datetime.utcnow(), '%y')),3)[1][6])+"/"+str(format(datetime.utcnow(), '%y'))+"-10","%m/%d/%y-%H") and datetime.utcnow()<datetime.strptime("11/"+str(calendar.monthcalendar(int(format(datetime.utcnow(), '%y')),11)[0][6])+"/"+str(format(datetime.utcnow(), '%y'))+"-9","%m/%d/%y-%H"):#in daylight saving
            self.lautcoffset=self.utcoffsetdaylight
        else:#out of daylight saving
            self.lautcoffset=self.utcoffsetstandard
            
    def buildlogoFrame(self):
        #set the fonts
        #font 5
        self.fontfive=QFont('arial')
        self.fontfive.setPointSize(20)
        self.fontfive.setBold(True)
        #font 6
        self.fontsix=QFont('arial')
        self.fontsix.setPointSize(16)
        self.fontsix.setBold(True)
        
        nwsfont=QFont('bahnschrift semibold condensed')
        nwsfont.setPointSize(16)

        officefont=QFont('bahnschrift condensed')
        officefont.setPointSize(16)

        self.logoFrame=QWidget(self)
        self.logoFrame.setGeometry(0,0,500,300)#(int x, int y, int w, int h)
        self.logoFrame.setStyleSheet('background-color: rgba(64,64,64,0); border: 2px solid; border-color: rgba(64,64,64,0); border-radius: 14px')
        self.logoFrameLayout=QFormLayout()
        self.logoFrame.setLayout(self.logoFrameLayout)
        
        textlayout=QHBoxLayout()

        #NWS logo in the top left
        nwslogo=QLabel()
        #nwslogo.setFixedWidth(410)
        #nwslogo.setFixedHeight(80)
        nwslogo.setStyleSheet('background-color: rgba(0,0,0,0)')
        nwslogo.setAlignment(Qt.AlignLeft)
        if os.path.isfile(self.iconpath + "dsoc.png"):
            self.nwslogoimage=QPixmap(self.iconpath + 'dsoc.png')#.scaledToWidth(340)
            self.nwslogoimage=self.nwslogoimage.scaled(275,275, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            #self.nwslogoimage=QPixmap('dosc.png').scaledToWidth(490)
            nwslogo.setPixmap(self.nwslogoimage)
        else:
            nwslogo.setFont(self.fonttwo)
            nwslogo.setText(" ")
        nwstext=QLabel()
        nwstext.setFont(nwsfont)
        nwstext.setText('')
        nwstext.setStyleSheet('color: white; border: 0px solid')
        nwstext.setAlignment(Qt.AlignLeft)
        nwstext.setFixedHeight(30)
        nwsoffice=QLabel()
        nwsoffice.setFont(officefont)
        nwsoffice.setText('')
        nwsoffice.setStyleSheet('color: white; border: 0px solid')
        nwsoffice.setAlignment(Qt.AlignLeft)
        nwsoffice.setFixedHeight(30)
        
        space=QLabel()
        
        textlayout.addWidget(nwslogo)
        textlayout.addWidget(nwstext)
        textlayout.addWidget(nwsoffice)
        textlayout.addWidget(space)
        
        self.logoFrameLayout.addRow(textlayout)
            
    def buildwarningFrame(self):
        #set the fonts for the left side
        #small fornt for title and area
        self.titlefont=QFont('arial')
        self.titlefont.setPointSize(12)
        self.titlefont.setBold(False)
        #Number of products font
        self.numberfont=QFont('arial')
        self.numberfont.setPointSize(32)
        self.numberfont.setBold(True)
        
        self.warningFrame=QWidget(self)
        self.warningFrame.setGeometry(20,185,400,110)#(int x, int y, int w, int h)
        self.warningFrame.setStyleSheet('background-color: rgb(64,64,64); border: 2px solid; border-color: rgb(64,64,64); border-radius: 14px')
        self.warningFrameLayout=QFormLayout()
        self.warningFrame.setLayout(self.warningFrameLayout)

        titlelabel=QLabel("Warnings")
        titlelabel.setStyleSheet('color: white')
        titlelabel.setFont(self.titlefont)
        titlelabel.setAlignment(Qt.AlignCenter)
        self.warningFrameLayout.addRow(titlelabel)

        self.numwarninglabel=QLabel("--")
        self.numwarninglabel.setStyleSheet('color: rgb(102,255,51)')#colors are Green (102,255,51) and Red (255,0,0)
        self.numwarninglabel.setFont(self.numberfont)
        self.numwarninglabel.setAlignment(Qt.AlignCenter)
        self.warningFrameLayout.addRow(self.numwarninglabel)

        self.warninglabel=QLabel("NA")
        self.warninglabel.setStyleSheet('color: white')
        self.warninglabel.setFont(self.titlefont)
        self.warninglabel.setAlignment(Qt.AlignCenter)
        self.warningFrameLayout.addRow(self.warninglabel)

    def buildwatchFrame(self):
        self.watchFrame=QWidget(self)
        self.watchFrame.setGeometry(20,305,400,110)#(int x, int y, int w, int h)
        self.watchFrame.setStyleSheet('background-color: rgb(64,64,64); border: 2px solid; border-color: rgb(64,64,64); border-radius: 14px')
        self.watchFrameLayout=QFormLayout()
        self.watchFrame.setLayout(self.watchFrameLayout)

        titlelabel=QLabel("Watches")
        titlelabel.setStyleSheet('color: white')
        titlelabel.setFont(self.titlefont)
        titlelabel.setAlignment(Qt.AlignCenter)
        self.watchFrameLayout.addRow(titlelabel)

        self.numwatchlabel=QLabel("--")
        self.numwatchlabel.setStyleSheet('color: rgb(102,255,51)')#colors are Green (102,255,51) and light Red (217,150,148)
        self.numwatchlabel.setFont(self.numberfont)
        self.numwatchlabel.setAlignment(Qt.AlignCenter)
        self.watchFrameLayout.addRow(self.numwatchlabel)

        self.watchlabel=QLabel("NA")
        self.watchlabel.setStyleSheet('color: white')
        self.watchlabel.setFont(self.titlefont)
        self.watchlabel.setAlignment(Qt.AlignCenter)
        self.watchFrameLayout.addRow(self.watchlabel)

    def buildadvisoryFrame(self):
        self.advisoryFrame=QWidget(self)
        self.advisoryFrame.setGeometry(20,425,400,110)#(int x, int y, int w, int h)
        self.advisoryFrame.setStyleSheet('background-color: rgb(64,64,64); border: 2px solid; border-color: rgb(64,64,64); border-radius: 14px')
        self.advisoryFrameLayout=QFormLayout()
        self.advisoryFrame.setLayout(self.advisoryFrameLayout)

        titlelabel=QLabel("Advisories")
        titlelabel.setStyleSheet('color: white')
        titlelabel.setFont(self.titlefont)
        titlelabel.setAlignment(Qt.AlignCenter)
        self.advisoryFrameLayout.addRow(titlelabel)

        self.numadvisorylabel=QLabel("--")
        self.numadvisorylabel.setStyleSheet('color: rgb(102,255,51)')#colors are Green (102,255,51) and yellow (255,192,0)
        self.numadvisorylabel.setFont(self.numberfont)
        self.numadvisorylabel.setAlignment(Qt.AlignCenter)
        self.advisoryFrameLayout.addRow(self.numadvisorylabel)

        self.advisorylabel=QLabel("NA")
        self.advisorylabel.setStyleSheet('color: white')
        self.advisorylabel.setFont(self.titlefont)
        self.advisorylabel.setAlignment(Qt.AlignCenter)
        self.advisoryFrameLayout.addRow(self.advisorylabel)
        
    def buildGISFrame(self):
        self.font=QFont('arial')
        self.font.setPointSize(18)
        self.font.setBold(True)
        #GIS Frame
        self.GISFrame=QWidget(self)
        self.GISFrame.setGeometry(450,155,1470,850)#(int x, int y, int w, int h)#(int x, int y, int w, int h)0,0,1420,700
        self.GISFrame.setStyleSheet('background-color: rgb(64,64,64); border: 2px solid; border-color: rgb(64,64,64); border-radius: 14px')

        self.GISFrame.show()
        self.canvas = QgsMapCanvas(self.GISFrame)
        self.canvas.show()
        self.canvas.setGeometry(0,0,1470,850)

        self.canvas.setCanvasColor(QColor(64,64,64))
        self.canvas.enableAntiAliasing(True)
        
        #layer update error window
        self.GISerrorWindow=QWidget(self.GISFrame)
        self.GISerrorWindow.setGeometry(410,15,650,60)#(int x, int y, int w, int h)0,0,1420,700
        self.GISerrorWindow.setStyleSheet('background-color: rgba(0,0,0,180); border: 0px solid; border-color: rgba(64,64,64,0); border-radius: 10px')
        self.GISerrorWindow.show()
        
        #Set up the frame layout
        self.GISerrorWindowLayout=QFormLayout()
        self.GISerrorWindow.setLayout(self.GISerrorWindowLayout)
        rowonelayout=QHBoxLayout()
        self.GISerrorWindowLayout.addRow(rowonelayout)

        self.erroriconlabel=QLabel()
        self.erroriconlabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.erroriconlabel.setFixedWidth(55)
        self.erroriconlabel.setAlignment(Qt.AlignCenter)
        self.erroriconlabel.setPixmap(self.erroricon)
        rowonelayout.addWidget(self.erroriconlabel)

        self.GISerrorlabel=QLabel()
        self.GISerrorlabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.GISerrorlabel.setAlignment(Qt.AlignCenter)
        self.font.setPointSize(16)
        self.font.setBold(False)
        self.GISerrorlabel.setFont(self.font)
        self.font.setPointSize(18)
        self.font.setBold(True)
        self.GISerrorlabel.setText("Multiple layers may be outdated")
        rowonelayout.addWidget(self.GISerrorlabel)
        
        topspace=QLabel(" ")
        topspace.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        rowonelayout.addWidget(topspace)

        self.statelayer = QgsVectorLayer(self.GISpath + 'StateBorders\\US_States.shp', "State layer", "ogr")
        self.statelayerdark = QgsVectorLayer(self.GISpath + 'StateBorders\\US_States.shp', "State layer Dark", "ogr")
        self.hillshadelayer=QgsRasterLayer(self.GISpath + 'Topo\\PRISM_us_dem_800m_bil.bil', "Hillshade Layer")
        self.stateborderlayer = QgsVectorLayer(self.GISpath + 'StateBorders\\US_States.shp', "State layer", "ogr")
        self.stateborderlayer2 = QgsVectorLayer(self.GISpath + 'StateBorders\\US_States.shp', "State layer2", "ogr")
        self.countylayer= QgsVectorLayer(self.GISpath + 'CountyBorders\cb_2018_us_county_500k.shp', "County layer", "ogr")
        self.countylayer2= QgsVectorLayer(self.GISpath + 'CountyBorders\cb_2018_us_county_500k.shp', "County layer Sat", "ogr")
        self.mrmslayer= QgsRasterLayer(self.GISpath + 'MRMS\MRMS_MergedBaseReflectivityQC.latest.grib2', "MRMS")
        self.mrmssnow= QgsRasterLayer(self.GISpath + 'MRMS\snowmask.tiff', "MRMS Snow")
        self.mrmsice= QgsRasterLayer(self.GISpath + 'MRMS\icemask.tiff', "MRMS Ice")
        self.mrmssleet= QgsRasterLayer(self.GISpath + 'MRMS\sleetmask.tiff', "MRMS Sleet")
        self.wwalayer= QgsVectorLayer(self.GISpath + 'WWA\DetailedWWA.shp', "WWA", "ogr")
        self.zonewwalayer= QgsVectorLayer(self.GISpath + 'WWA\current_all.shp', "Zone WWA layer", "ogr")
        self.shortfuselayer= QgsVectorLayer(self.GISpath + 'WWA\current_all.shp', "Short Fuse layer", "ogr")
        self.convectivewatchlayer= QgsVectorLayer(self.GISpath + 'WWA\SevereWWA.shp', "Convective Watches", "ogr")
        self.cities=QgsVectorLayer(self.GISpath + 'Cities\\AllCitiesandTowns.shp', "City layer", "ogr")
        self.roads=QgsVectorLayer(self.GISpath + '\Roads\\Roads.shp', "Roads", "ogr")
        self.riverlayer=QgsVectorLayer(self.GISpath + "RFC\\national_shapefile_fcst_ffep.shp", "River Data", "ogr")
        self.d1convective=QgsVectorLayer(self.GISpath + "\Outlooks\\SPC\\Convective\day1otlk_cat.shp", "Day 1 Convective Outlook", "ogr")
        self.d2convective=QgsVectorLayer(self.GISpath + "\Outlooks\\SPC\\Convective\day2otlk_cat.shp", "Day 2 Convective Outlook", "ogr")
        self.d3convective=QgsVectorLayer(self.GISpath + "\Outlooks\\SPC\\Convective\day3otlk_cat.shp", "Day 3 Convective Outlook", "ogr")
        self.d4convective=QgsVectorLayer(self.GISpath + "\Outlooks\\SPC\\Convective\day4prob.shp", "Day 4 Convective Outlook", "ogr")
        self.d5convective=QgsVectorLayer(self.GISpath + "\Outlooks\\SPC\\Convective\day5prob.shp", "Day 5 Convective Outlook", "ogr")
        self.d6convective=QgsVectorLayer(self.GISpath + "\Outlooks\\SPC\\Convective\day6prob.shp", "Day 6 Convective Outlook", "ogr")
        self.d7convective=QgsVectorLayer(self.GISpath + "\Outlooks\\SPC\\Convective\day7prob.shp", "Day 7 Convective Outlook", "ogr")
        self.d1fireoutlook=QgsVectorLayer(self.GISpath + "Outlooks\\SPC\\Fire\\firewx_day1.shp", "Day 1 Fire Outlook", "ogr")
        self.d2fireoutlook=QgsVectorLayer(self.GISpath + "Outlooks\\SPC\\Fire\\firewx_day2.shp", "Day 2 Fire Outlook", "ogr")
        self.d1rainoutlook=QgsVectorLayer(self.GISpath + "Outlooks\\WPC\EXCESSIVERAIN_Day1_latest.shp", "Day 1 Excessive Rain Outlook", "ogr")
        self.d2rainoutlook=QgsVectorLayer(self.GISpath + "Outlooks\\WPC\EXCESSIVERAIN_Day2_latest.shp", "Day 2 Excessive Rain Outlook", "ogr")
        self.d3rainoutlook=QgsVectorLayer(self.GISpath + "Outlooks\\WPC\EXCESSIVERAIN_Day3_latest.shp", "Day 3 Excessive Rain Outlook", "ogr")
        self.d4rainoutlook=QgsVectorLayer(self.GISpath + "Outlooks\\WPC\EXCESSIVERAIN_Day4_latest.shp", "Day 4 Excessive Rain Outlook", "ogr")
        self.d5rainoutlook=QgsVectorLayer(self.GISpath + "Outlooks\\WPC\EXCESSIVERAIN_Day5_latest.shp", "Day 5 Excessive Rain Outlook", "ogr")
        self.zonelayer=QgsVectorLayer(self.GISpath + "\Zones\\z_07se22.shp", "Public Zones", "ogr")
        self.firezones=QgsVectorLayer(self.GISpath + "\FireZones\\z_07se22.shp", "Fire Zones", "ogr")
        self.cwalayer=QgsVectorLayer(self.GISpath + "\CWA\\w_10nv20.shp", "CWA Layer", "ogr")
        self.lsrlayer=QgsVectorLayer(self.GISpath + "\\Outlooks\\SPC\\Convective\\lsr.shp", "LSR", "ogr")
        self.currentwildfirelayer=QgsVectorLayer(self.GISpath + "CalFire\\Current_Wildfire_Perimeters.shp", "Current Wildfire Perimeters", "ogr")
        self.geocolorsat= QgsRasterLayer(self.GISpath + 'Satellite\GOES16-ABI-CONUS-GEOCOLOR-5000x3000.tif', "GOES GeoColor")
        self.goesvis= QgsRasterLayer(self.GISpath + 'Satellite\GOES16-ABI-CONUS-02-GeoTIFF.kmz', "GOES Visible")
        self.calakes=QgsVectorLayer(self.GISpath + "Lakes\\USLakes.shp", "CA Lakes", "ogr")
        self.mdlayer=QgsVectorLayer(self.GISpath + "\\Outlooks\\SPC\\Convective\\MDs.shp", "MD", "ogr")
        self.mpdlayer=QgsVectorLayer(self.GISpath + "Outlooks\\WPC\\MPDs.shp", "MPD", "ogr")

        if not self.mpdlayer.isValid():
            print("\n\nLayer failed to load!\n\n")

        self.statelayer.loadNamedStyle(self.GISpath + 'StateBorders\StateStyle.qml')
        self.statelayerdark.loadNamedStyle(self.GISpath + 'StateBorders\StateStyleDark.qml')
        self.hillshadelayer.loadNamedStyle(self.GISpath + 'Topo\HillShade3.qml')
        self.stateborderlayer.loadNamedStyle(self.GISpath + 'StateBorders\StateBorderStyle.qml')
        self.stateborderlayer2.loadNamedStyle(self.GISpath + 'StateBorders\StateBorderStyle_Sat.qml')
        self.countylayer.loadNamedStyle(self.GISpath + 'CountyBorders\CountyStyle.qml')
        self.countylayer2.loadNamedStyle(self.GISpath + 'CountyBorders\CountyStyle_Sat.qml')
        self.mrmslayer.loadNamedStyle(self.GISpath + 'MRMS\RadarStyle.qml')
        self.mrmssnow.loadNamedStyle(self.GISpath + 'MRMS\SnowStyle.qml')
        self.mrmsice.loadNamedStyle(self.GISpath + 'MRMS\IceStyle.qml')
        self.mrmssleet.loadNamedStyle(self.GISpath + 'MRMS\SleetStyle.qml') 
        self.wwalayer.loadNamedStyle(self.GISpath + 'WWA\WWAStyle.qml')
        self.zonewwalayer.loadNamedStyle(self.GISpath + 'WWA\WWAStyle.qml')
        self.shortfuselayer.loadNamedStyle(self.GISpath + 'WWA\ShortWarningStyle.qml')
        self.convectivewatchlayer.loadNamedStyle(self.GISpath + 'WWA\SevereWatchStyle.qml')
        self.cities.loadNamedStyle(self.GISpath + '\Cities\AllCitiesandTownsStyle.qml')
        self.roads.loadNamedStyle(self.GISpath + '\Roads\\RoadsStyle.qml')
        self.riverlayer.loadNamedStyle(self.GISpath + 'RFC\\RiverStyle.qml')
        self.d1convective.loadNamedStyle(self.GISpath + 'Outlooks\SPC\Convective\ConvectiveStyle.qml')
        self.d2convective.loadNamedStyle(self.GISpath + 'Outlooks\SPC\Convective\ConvectiveStyle.qml')
        self.d3convective.loadNamedStyle(self.GISpath + 'Outlooks\SPC\Convective\ConvectiveStyle.qml')
        self.d4convective.loadNamedStyle(self.GISpath + 'Outlooks\SPC\Convective\ConvectiveStyle_Extended.qml')
        self.d5convective.loadNamedStyle(self.GISpath + 'Outlooks\SPC\Convective\ConvectiveStyle_Extended.qml')
        self.d6convective.loadNamedStyle(self.GISpath + 'Outlooks\SPC\Convective\ConvectiveStyle_Extended.qml')
        self.d7convective.loadNamedStyle(self.GISpath + 'Outlooks\SPC\Convective\ConvectiveStyle_Extended.qml')
        self.d1fireoutlook.loadNamedStyle(self.GISpath + 'Outlooks\SPC\Fire\FireStyle3.qml')
        self.d2fireoutlook.loadNamedStyle(self.GISpath + 'Outlooks\SPC\Fire\FireStyle3.qml')
        self.d1rainoutlook.loadNamedStyle(self.GISpath + 'Outlooks\WPC\WPC.qml')
        self.d2rainoutlook.loadNamedStyle(self.GISpath + 'Outlooks\WPC\WPC.qml')
        self.d3rainoutlook.loadNamedStyle(self.GISpath + 'Outlooks\WPC\WPC.qml')
        self.d4rainoutlook.loadNamedStyle(self.GISpath + 'Outlooks\WPC\WPC.qml')
        self.d5rainoutlook.loadNamedStyle(self.GISpath + 'Outlooks\WPC\WPC.qml')
        self.lsrlayer.loadNamedStyle(self.GISpath + '\\Outlooks\\SPC\\Convective\\LSRStyle.qml')
        self.geocolorsat.loadNamedStyle(self.GISpath + 'Satellite\GeoColorStyle.qml')
        self.goesvis.loadNamedStyle(self.GISpath + 'Satellite\GoesVisStyle.qml')
        self.calakes.loadNamedStyle(self.GISpath + 'Lakes\\LakeStyle.qml')
        self.mdlayer.loadNamedStyle(self.GISpath + '\\Outlooks\\SPC\\Convective\\MDStyle.qml')
        self.mpdlayer.loadNamedStyle(self.GISpath + 'Outlooks\\WPC\\MPDStyle.qml')
        
        #resampleFilter = self.mrmslayer.resampleFilter()
        #resampleFilter.setZoomedInResampler(QgsBilinearRasterResampler())
        #resampleFilter.setZoomedOutResampler(QgsBilinearRasterResampler())

        # add layer to the registry
        QgsProject.instance().addMapLayer(self.hillshadelayer)
        QgsProject.instance().addMapLayer(self.statelayer)
        QgsProject.instance().addMapLayer(self.statelayerdark)
        QgsProject.instance().addMapLayer(self.stateborderlayer)
        QgsProject.instance().addMapLayer(self.stateborderlayer2)
        QgsProject.instance().addMapLayer(self.countylayer)
        QgsProject.instance().addMapLayer(self.countylayer2)
        QgsProject.instance().addMapLayer(self.wwalayer)
        QgsProject.instance().addMapLayer(self.zonewwalayer)
        QgsProject.instance().addMapLayer(self.shortfuselayer)
        QgsProject.instance().addMapLayer(self.convectivewatchlayer)
        QgsProject.instance().addMapLayer(self.mrmslayer)
        QgsProject.instance().addMapLayer(self.mrmssnow)
        QgsProject.instance().addMapLayer(self.mrmsice)
        QgsProject.instance().addMapLayer(self.mrmssleet)
        QgsProject.instance().addMapLayer(self.cities)
        QgsProject.instance().addMapLayer(self.roads)
        QgsProject.instance().addMapLayer(self.riverlayer)
        QgsProject.instance().addMapLayer(self.d1convective)
        QgsProject.instance().addMapLayer(self.d2convective)
        QgsProject.instance().addMapLayer(self.d3convective)
        QgsProject.instance().addMapLayer(self.d4convective)
        QgsProject.instance().addMapLayer(self.d5convective)
        QgsProject.instance().addMapLayer(self.d6convective)
        QgsProject.instance().addMapLayer(self.d7convective)
        QgsProject.instance().addMapLayer(self.d1fireoutlook)
        QgsProject.instance().addMapLayer(self.d2fireoutlook)
        QgsProject.instance().addMapLayer(self.d1rainoutlook)
        QgsProject.instance().addMapLayer(self.d2rainoutlook)
        QgsProject.instance().addMapLayer(self.d3rainoutlook)
        QgsProject.instance().addMapLayer(self.d4rainoutlook)
        QgsProject.instance().addMapLayer(self.d5rainoutlook)
        QgsProject.instance().addMapLayer(self.zonelayer)
        QgsProject.instance().addMapLayer(self.firezones)
        QgsProject.instance().addMapLayer(self.cwalayer)
        QgsProject.instance().addMapLayer(self.lsrlayer)
        QgsProject.instance().addMapLayer(self.geocolorsat)
        QgsProject.instance().addMapLayer(self.goesvis)
        QgsProject.instance().addMapLayer(self.calakes)
        QgsProject.instance().addMapLayer(self.mdlayer)
        QgsProject.instance().addMapLayer(self.mpdlayer)

        #for i in range(8):
        for band in range(1, self.geocolorsat.bandCount()+1):
            provider = self.geocolorsat.dataProvider()
            provider.setNoDataValue(band, -10)

        self.outlooks=[[self.mdlayer,'Meso Discussion'],[self.mpdlayer,'Precip Meso Discussion'],[self.d1convective,"Day 1 Convective Outlook"],[self.d2convective,"Day 2 Convective Outlook"],[self.d3convective,"Day 3 Convective Outlook"],
                        [self.d4convective,"Day 4 Convective Outlook"],[self.d5convective,"Day 5 Convective Outlook"],[self.d6convective,"Day 6 Convective Outlook"],[self.d7convective,"Day 7 Convective Outlook"],[self.d1fireoutlook,"Day 1 Fire Outlook"],
                       [self.d2fireoutlook,"Day 2 Fire Outlook"],[self.d1rainoutlook,"Day 1 Excessive Rain Outlook"],[self.d2rainoutlook,"Day 2 Excessive Rain Outlook"],[self.d3rainoutlook,"Day 3 Excessive Rain Outlook"],[self.d4rainoutlook,"Day 4 Excessive Rain Outlook"],[self.d5rainoutlook,"Day 5 Excessive Rain Outlook"]]

        #self.activeoutlook=self.outlooks
        self.activeoutlook=[[self.d1convective,"Day 1 Convective Outlook"],[self.d1fireoutlook,"Day 1 Fire Outlook"],[self.d1rainoutlook,"Day 1 Excessive Rain Outlook"],[self.mdlayer,'Meso Discussion'],[self.mpdlayer,'Precip Meso Discussion']]
        
        self.alllayers=[[self.riverlayer,"River Data"],[self.lsrlayer,"LSR"],
                        [self.shortfuselayer,"Short fuesed Warnings"],[self.convectivewatchlayer,'Convective Watches'],[self.activeoutlook,"Outlooks"],[self.cities,"Cities"],
                        [self.roads,"Roads"],[self.stateborderlayer,"State Borders"],[self.countylayer,"County Borders"],
                        [[self.mrmssnow,self.mrmsice,self.mrmssleet],"MRMS Precip Type"],
                        [self.mrmslayer,"MRMS Radar"],[self.geocolorsat,"GOES GeoColor"],[self.goesvis,"GOES Visible"],
                        [self.calakes,"CA Lakes"],[self.wwalayer,"WWA"],[self.zonewwalayer,"ZoneWWA"],[[self.hillshadelayer,self.statelayerdark],"Hillshade Layer"],[self.statelayer,"Background"]]
        
        self.activelayers=[]
        self.zonewwalayer.setSubsetString('"VTEC" = ' + "'" + str("") + "'")
        #Winter list
        self.layerofflist=["GOES Visible","GOES GeoColor","Hillshade Layer","Hot Spots"]
        #Summer list
        #self.layerofflist=["Road Colsures","GOES Visible","GOES GeoColor","Hillshade Layer","Current Burn Scars"]
        for i in self.alllayers:
            if i[1] not in self.layerofflist:
                if i[1]=="Hot Spots" or i[1]=="Hillshade Layer" or i[1]=="MRMS Precip Type":
                    for j in i[0]:
                        self.activelayers.append(j)
                elif i[1]=="Outlooks":
                    for outlooks in self.activeoutlook:
                        self.activelayers.append(outlooks[0])
                else:
                    self.activelayers.append(i[0])
        
        # set the map canvas layer set [top layer first to bottom layer last]
        self.canvas.setLayers(self.activelayers)
        
        self.actionZoomIn = QAction("Zoom in", self.GISFrame)
        self.actionZoomOut = QAction("Zoom out", self.GISFrame)
        self.actionPan = QAction("Pan", self.GISFrame)

        self.actionZoomIn.setCheckable(True)
        self.actionZoomOut.setCheckable(True)
        self.actionPan.setCheckable(True)

        self.actionZoomIn.triggered.connect(self.zoomIn)
        self.actionZoomOut.triggered.connect(self.zoomOut)
        self.actionPan.triggered.connect(self.pan)

        # create the map tool buttons
        self.toolPan = QgsMapToolPan(self.canvas)
        self.toolPan.setAction(self.actionPan)
        self.toolZoomIn = QgsMapToolZoom(self.canvas, False) # false = in
        self.toolZoomIn.setAction(self.actionZoomIn)
        self.toolZoomOut = QgsMapToolZoom(self.canvas, True) # true = out
        self.toolZoomOut.setAction(self.actionZoomOut)

        self.layerbutt=QPushButton(self.GISFrame)
        self.layerbutt.setGeometry(10,10,25,25)#(int x, int y, int w, int h)
        self.layerbutt.show()
        self.layerbutt.setStyleSheet("background-color: rgba(0,0,0,180); border: 0px solid; border-color: white; border-radius: 5px")
        self.layerbutt.setFlat(True)
        self.layerbutt.setIcon(QIcon(QPixmap(self.iconpath + "LayerIcon.png")))
        self.layerbutt.setIconSize(QSize(20,20))
        self.layerbutt.clicked.connect(lambda: self.showgisframes(0))

        self.panbutt=QPushButton(self.GISFrame)
        self.panbutt.setGeometry(10,40,25,25)#(int x, int y, int w, int h)
        self.panbutt.show()
        self.panbutt.setStyleSheet("background-color: rgba(0,0,0,180); border: 2px solid; border-color: rgb(0,250,0); border-radius: 5px")
        self.panbutt.setFlat(True)
        self.panbutt.setIcon(QIcon(QPixmap(self.iconpath + "PanIcon.png")))
        self.panbutt.setIconSize(QSize(20,20))
        self.panbutt.clicked.connect(lambda: self.pan())

        self.giszoombutt=QPushButton(self.GISFrame)
        self.giszoombutt.setGeometry(10,70,25,25)#(int x, int y, int w, int h)
        self.giszoombutt.show()
        self.giszoombutt.setStyleSheet("background-color: rgba(0,0,0,180); border: 0px solid; border-color: white; border-radius: 5px")
        self.giszoombutt.setFlat(True)
        self.giszoombutt.setIcon(QIcon(QPixmap(self.iconpath + "ZoomIcon.png")))
        self.giszoombutt.setIconSize(QSize(20,20))
        self.giszoombutt.clicked.connect(lambda: self.zoomIn())

        self.outlooklayerbutt=QPushButton(self.GISFrame)
        self.outlooklayerbutt.setGeometry(10,100,25,25)#(int x, int y, int w, int h)
        self.outlooklayerbutt.show()
        self.outlooklayerbutt.setStyleSheet("background-color: rgba(0,0,0,180); border: 0px solid; border-color: white; border-radius: 5px")
        self.outlooklayerbutt.setFlat(True)
        self.outlooklayerbutt.setIcon(QIcon(QPixmap(self.iconpath + "OutlookIcon.png")))
        self.outlooklayerbutt.setIconSize(QSize(20,20))
        self.outlooklayerbutt.clicked.connect(lambda: self.showgisframes(2))

        #Build layer button frame
        self.layerbuttonFrame=QWidget(self.GISFrame)
        self.layerbuttonFrame.setGeometry(50,10,220,460)#(int x, int y, int w, int h)
        self.layerbuttonFrame.setStyleSheet("background-color: rgba(0,0,0,180); border: 0px solid; border-color: white; border-radius: 15px")
        layerbuttonFramelayout=QFormLayout()
        self.layerbuttonFrame.setLayout(layerbuttonFramelayout)
        self.layerbuttonFrame.hide()

        exitbutt=QPushButton()
        exitbutt.setStyleSheet("QPushButton {text-align: right ;border: 0px solid; color: white; background-color: rgba(110,110,110,0)}" "QPushButton:pressed {color: white; background-color: rgba(110,110,110,0)}")
        exitbutt.setFlat(True)
        exitbutt.setText("X")
        exitbutt.setFixedHeight(15)
        exitbutt.clicked.connect(lambda: self.layerbuttonFrame.hide())
        layerbuttonFramelayout.addRow(exitbutt)

        self.layerbutton={}
        self.layerstatus={}
        for i in range(len(self.alllayers)):
            if self.alllayers[i][1]!="Outlooks" and self.alllayers[i][1]!="ZoneWWA":# and self.alllayers[i][1]!="DSS Only Ring":
                self.layerbutton[str(i)]=QPushButton(self.alllayers[i][1])
                self.layerbutton[str(i)].setStyleSheet("QPushButton {text-align: left ;border: 0px solid; color: white; background-color: rgba(110,110,110,0)}" "QPushButton:pressed {color: white; background-color: rgba(110,110,110,0)}")
                self.layerbutton[str(i)].setFlat(False)
                self.layerbutton[str(i)].setFixedHeight(20)
                if self.alllayers[i][1] in self.layerofflist:
                    self.layerbutton[str(i)].setIcon(QIcon(QPixmap(self.iconpath + "LayerOffIcon.png")))
                    self.layerbutton[str(i)].setIconSize(QSize(20,20))
                    self.layerstatus[str(i)]="off"
                else:
                    self.layerbutton[str(i)].setIcon(QIcon(QPixmap(self.iconpath + "LayerOnIcon.png")))
                    self.layerbutton[str(i)].setIconSize(QSize(20,20))
                    self.layerstatus[str(i)]="on"         
                self.layerbutton[str(i)].clicked.connect(lambda checked, arg=i: self.updatelayers(arg))
                layerbuttonFramelayout.addRow(self.layerbutton[str(i)])

        self.canvas.setCurrentLayer(self.wwalayer)

        #Build Outlook layer button frame
        self.outlooklayerFrame=QWidget(self.GISFrame)
        self.outlooklayerFrame.setGeometry(50,100,220,210)#(int x, int y, int w, int h)
        self.outlooklayerFrame.setStyleSheet("background-color: rgba(0,0,0,180); border: 0px solid; border-color: white; border-radius: 15px")
        outlooklayerFramelayout=QFormLayout()
        self.outlooklayerFrame.setLayout(outlooklayerFramelayout)
        self.outlooklayerFrame.hide()

        outlooklayerexitbutt=QPushButton()
        outlooklayerexitbutt.setStyleSheet("QPushButton {text-align: right ;border: 0px solid; color: white; background-color: rgba(110,110,110,0)}" "QPushButton:pressed {color: white; background-color: rgba(110,110,110,0)}")
        outlooklayerexitbutt.setFlat(True)
        outlooklayerexitbutt.setText("X")
        outlooklayerexitbutt.setFixedHeight(15)
        outlooklayerexitbutt.clicked.connect(lambda: self.outlooklayerFrame.hide())
        outlooklayerFramelayout.addRow(outlooklayerexitbutt)

        activeoutlooks=[]
        for i in self.activeoutlook:
            activeoutlooks.append(i[1])

        self.outlooklayerbutton={}
        self.outlooklayerstatus={}
        for i in range(len(self.outlooks)):
            self.outlooklayerbutton[str(i)]=QPushButton(self.outlooks[i][1])
            self.outlooklayerbutton[str(i)].setStyleSheet("QPushButton {text-align: left ;border: 0px solid; color: white; background-color: rgba(110,110,110,0)}" "QPushButton:pressed {color: white; background-color: rgba(110,110,110,0)}")
            self.outlooklayerbutton[str(i)].setFlat(False)
            self.outlooklayerbutton[str(i)].setFixedHeight(20)
            if self.outlooks[i][1] in activeoutlooks:
                self.outlooklayerbutton[str(i)].setIcon(QIcon(QPixmap(self.iconpath + "LayerOnIcon.png")))
                self.outlooklayerbutton[str(i)].setIconSize(QSize(20,20))
                self.outlooklayerstatus[str(i)]="on"
            else:
                self.outlooklayerbutton[str(i)].setIcon(QIcon(QPixmap(self.iconpath + "LayerOffIcon.png")))
                self.outlooklayerbutton[str(i)].setIconSize(QSize(20,20))
                self.outlooklayerstatus[str(i)]="off"      
            self.outlooklayerbutton[str(i)].clicked.connect(lambda checked, arg=i: self.updateoutlooklayers(arg))
            outlooklayerFramelayout.addRow(self.outlooklayerbutton[str(i)])

        #Download icons
        self.downloadlabel=QLabel(self.GISFrame)
        self.downloadlabel.setGeometry(1415,10,45,45)#(int x, int y, int w, int h)1000,830
        self.downloadlabel.setStyleSheet('color: white; background-color: rgba(0,120,0,0); border: 0px solid')
        self.downloadlabel.setPixmap(self.downloadicon)
        self.downloadlabel.setAlignment(Qt.AlignCenter)
        self.downloadlabel.hide()

        self.nodownloadlabel=QLabel(self.GISFrame)
        self.nodownloadlabel.setGeometry(1415,10,45,45)#(int x, int y, int w, int h)1000,830
        self.nodownloadlabel.setStyleSheet('color: white; background-color: rgba(0,120,0,0); border: 0px solid')
        self.nodownloadlabel.setPixmap(self.nodownloadicon)
        self.nodownloadlabel.setAlignment(Qt.AlignCenter)
        self.nodownloadlabel.hide()

        #self.infobox()
        #self.giscamerabox()
        self.pan()
        self.canvas.setExtent(QgsRectangle(-91.94,40.70,-80.35,33.71))

        #self.canvas.extentsChanged.connect(self.canvasmoved)
        
    def zoomIn(self):
        self.canvas.setMapTool(self.toolZoomIn)
        self.canvas.currentLayer().removeSelection()
        self.panbutt.setStyleSheet("background-color: rgba(0,0,0,180); border: 0px solid; border-color: rgb(0,250,0); border-radius: 5px")
        self.giszoombutt.setStyleSheet("background-color: rgba(0,0,0,180); border: 2px solid; border-color: rgb(0,250,0); border-radius: 5px")

    def zoomOut(self):
        self.canvas.setMapTool(self.toolZoomOut)

    def pan(self):
        self.canvas.setMapTool(self.toolPan)
        self.canvas.currentLayer().removeSelection()
        self.panbutt.setStyleSheet("background-color: rgba(0,0,0,180); border: 2px solid; border-color: rgb(0,250,0); border-radius: 5px")
        self.giszoombutt.setStyleSheet("background-color: rgba(0,0,0,180); border: 0px solid; border-color: white; border-radius: 5px")
        
    def updatelayers(self, buttnum):
        buttnum=str(buttnum)
        #remove a layer
        if self.layerstatus[buttnum]=="on":
            if self.alllayers[int(buttnum)][1]=="Hot Spots" or self.alllayers[int(buttnum)][1]=="Hillshade Layer" or self.alllayers[int(buttnum)][1]=="MRMS Precip Type":
                for i in self.alllayers[int(buttnum)][0]:
                    self.activelayers.remove(i)
            else:    
                self.activelayers.remove(self.alllayers[int(buttnum)][0])
            self.canvas.setLayers(self.activelayers)
            self.layerstatus[buttnum]="off"
            self.layerbutton[buttnum].setIcon(QIcon(QPixmap(self.iconpath + "LayerOffIcon.png")))
            self.layerbutton[buttnum].setIconSize(QSize(20,20))
            if self.alllayers[int(buttnum)][1]=="Hillshade Layer":
                self.wwalayer.loadNamedStyle(self.GISpath + 'WWA\WWAStyle.qml')
                self.countylayer.loadNamedStyle(self.GISpath + 'CountyBorders\CountyStyle.qml')
            if self.alllayers[int(buttnum)][1]=="GOES GeoColor" or self.alllayers[int(buttnum)][1]=="GOES Visible":
                self.stateborderlayer.loadNamedStyle(self.GISpath + 'StateBorders\StateBorderStyle.qml')
                self.countylayer.loadNamedStyle(self.GISpath + 'CountyBorders\CountyStyle.qml')
        #add a layer
        else:
            templayerlist=[]
            for i in self.alllayers:
                if i[1]=="Hot Spots" or i[1]=="Hillshade Layer" or i[1]=="MRMS Precip Type":
                    for j in i[0]:
                        if j in self.activelayers:
                            templayerlist.append(j)
                elif i[1]=="Outlooks":
                    for outlooks in self.activeoutlook:
                        templayerlist.append(outlooks[0])
                elif i[0] in self.activelayers:
                    templayerlist.append(i[0])
                if i[0]==self.alllayers[int(buttnum)][0]:
                    if i[1]=="Hot Spots" or i[1]=="Hillshade Layer" or i[1]=="MRMS Precip Type":
                        for j in i[0]:
                            templayerlist.append(j)
                    else:
                        templayerlist.append(self.alllayers[int(buttnum)][0])
                    self.layerstatus[buttnum]="on"
                    self.layerbutton[buttnum].setIcon(QIcon(QPixmap(self.iconpath + "LayerOnIcon.png")))
                    self.layerbutton[buttnum].setIconSize(QSize(20,20))
            if self.alllayers[int(buttnum)][1]=="Hillshade Layer":
                self.wwalayer.loadNamedStyle(self.GISpath + 'WWA\WWAStyle2.qml')
                self.countylayer.loadNamedStyle(self.GISpath + 'CountyBorders\CountyStyleDark.qml')
                #self.countylayer.loadNamedStyle(self.GISpath + 'CountyBorders\CountyStyle_Sat.qml')
            if self.alllayers[int(buttnum)][1]=="GOES GeoColor" or self.alllayers[int(buttnum)][1]=="GOES Visible":
                self.stateborderlayer.loadNamedStyle(self.GISpath + 'StateBorders\StateBorderStyle_Sat.qml')
                self.countylayer.loadNamedStyle(self.GISpath + 'CountyBorders\CountyStyle_Sat.qml')                    
            self.activelayers=templayerlist
            self.canvas.setLayers(self.activelayers)

    def updateoutlooklayers(self, buttnum):
        buttnum=str(buttnum)
        if self.outlooklayerstatus[buttnum]=="on":   
            self.activelayers.remove(self.outlooks[int(buttnum)][0])
            self.canvas.setLayers(self.activelayers)
            self.outlooklayerstatus[buttnum]="off"
            self.outlooklayerbutton[buttnum].setIcon(QIcon(QPixmap(self.iconpath + "LayerOffIcon.png")))
            self.outlooklayerbutton[buttnum].setIconSize(QSize(20,20))

            activeoutlooks=[]
            for i in self.activeoutlook:
                activeoutlooks.append(i[0])
            templayerlist=[]
            for i in self.outlooks:
                if i[0] in activeoutlooks and i[0] != self.outlooks[int(buttnum)][0]:
                    templayerlist.append([i[0],i[1]])
            self.activeoutlook=templayerlist
        else:
            activeoutlooks=[]
            for i in self.activeoutlook:
                activeoutlooks.append(i[0])
            templayerlist=[]
            for i in self.outlooks:
                if i[0] in activeoutlooks:
                    templayerlist.append([i[0],i[1]])
                elif i[0]==self.outlooks[int(buttnum)][0]:
                    templayerlist.append(self.outlooks[int(buttnum)])
            self.activeoutlook=templayerlist
            templayerlist=[]
            for i in self.alllayers:
                if i[1]=="Interstates" or i[1]=="Hillshade Layer" or i[1]=="MRMS Precip Type":
                    for j in i[0]:
                        if j in self.activelayers:
                            templayerlist.append(j)
                elif i[1]=="Outlooks":
                    for outlooks in self.activeoutlook:
                        templayerlist.append(outlooks[0])
                elif i[0] in self.activelayers:
                    templayerlist.append(i[0])

                self.outlooklayerstatus[buttnum]="on"
                self.outlooklayerbutton[buttnum].setIcon(QIcon(QPixmap(self.iconpath + "LayerOnIcon.png")))
                self.outlooklayerbutton[buttnum].setIconSize(QSize(20,20))
            self.activelayers=templayerlist
            self.canvas.setLayers(self.activelayers)
            
    def showgisframes(self, frame):
        if frame==0:
            self.layerbuttonFrame.show()
            self.outlooklayerFrame.hide()
            self.layerbuttonFrame.setGeometry(50,10,220,390)#(int x, int y, int w, int h)
        elif frame==1:
            self.layerbuttonFrame.hide()
            self.outlooklayerFrame.hide()
            self.setextentFrame.setGeometry(80,10,105,165)#(int x, int y, int w, int h)
        elif frame==2:
            self.outlooklayerFrame.show()
            self.layerbuttonFrame.hide()
            self.outlooklayerFrame.setGeometry(50,100,220,210)#(int x, int y, int w, int h)
        
    def buildtimeFrame(self):
        #Time Frame
        self.timeFrame=QWidget(self)
        self.timeFrame.setGeometry(790,0,790,155)#(int x, int y, int w, int h)410,0,790,155
        self.timeFrame.setStyleSheet('background-color: rgba(120,120,120,0)')
        self.timeFrameLayout=QHBoxLayout()
        self.timeFrame.setLayout(self.timeFrameLayout)
        #set the fonts
        #big time font
        self.fontone=QFont('arial')
        self.fontone.setPointSize(36)
        self.fontone.setBold(True)
        #smaller time font
        self.fonttwo=QFont('arial')
        self.fonttwo.setPointSize(14)
        self.fonttwo.setBold(False)

        localtimeframe=QWidget()
        localtimeFrameLayout=QFormLayout()
        localtimeframe.setLayout(localtimeFrameLayout)
        localtimeframe.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        utctimeframe=QWidget()
        utctimeFrameLayout=QFormLayout()
        utctimeframe.setLayout(utctimeFrameLayout)
        utctimeframe.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.timeFrameLayout.addWidget(localtimeframe)
        self.timeFrameLayout.addWidget(utctimeframe)

        #Sac Label
        self.saclabel=QLabel()
        self.saclabel.setText('Bowling Green, KY')
        self.saclabel.setFont(self.fonttwo)
        self.saclabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.saclabel.setAlignment(Qt.AlignCenter)
        localtimeFrameLayout.addRow(self.saclabel)
        
        #create the horizontal layout for the local time do to more than two widgets
        self.localtimelayout=QHBoxLayout()
        #local 12-hour time
        self.localtime12=QLabel()
        self.localtime12.setFont(self.fontone)
        self.localtime12.setFixedWidth(185)
        self.localtime12.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.localtime12.setAlignment(Qt.AlignRight)
        self.localtimelayout.addWidget(self.localtime12)

        #local seconds and daypart
        self.localseconds=QLabel()
        self.localseconds.setFixedWidth(50)
        self.fonttwo.setBold(True)
        self.localseconds.setFont(self.fonttwo)
        self.fonttwo.setBold(False)
        self.localseconds.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.localseconds.setAlignment(Qt.AlignLeft)
        self.localtimelayout.addWidget(self.localseconds)

        #Downtown Sac Temperature
        self.dtsactemp=QLabel()
        self.dtsactemp.setFont(self.fontone)
        self.dtsactemp.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.dtsactemp.setAlignment(Qt.AlignLeft)
        self.dtsactemp.setText("--" + u'\N{DEGREE SIGN}')
        self.localtimelayout.addWidget(self.dtsactemp)
        localtimeFrameLayout.addRow(self.localtimelayout)

        #local 24 hour time
        self.localtime24=QLabel()
        self.localtime24.setFont(self.fonttwo)
        self.localtime24.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.localtime24.setAlignment(Qt.AlignCenter)
        localtimeFrameLayout.addRow(self.localtime24)

        #UTC Label
        self.utclabel=QLabel("UTC")
        self.utclabel.setFont(self.fonttwo)
        self.utclabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.utclabel.setAlignment(Qt.AlignCenter)
        utctimeFrameLayout.addRow(self.utclabel)

        #Utc time
        self.utctime=QLabel()
        self.utctime.setFont(self.fontone)
        self.utctime.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.utctime.setAlignment(Qt.AlignCenter)
        utctimeFrameLayout.addRow(self.utctime)

        #Utc date
        self.utcdate=QLabel()
        self.utcdate.setFont(self.fonttwo)
        self.utcdate.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.utcdate.setAlignment(Qt.AlignCenter)
        utctimeFrameLayout.addRow(self.utcdate)
        
    def buildcurrentwxFrame(self):
        #Current Weather Frame
        self.wxFrame=QWidget(self)
        self.wxFrame.setGeometry(0,500,480,350)#(int x, int y, int w, int h)#700 1410,660,510,350 // 1410,635,510,350
        self.wxFrame.setStyleSheet('background-color: rgba(0,120,0,0)')
        self.wxFrameLayout=QFormLayout()
        self.wxFrame.setLayout(self.wxFrameLayout)
        #set the fonts
        #font 3
        self.fontthree=QFont('arial')
        self.fontthree.setPointSize(58)
        self.fontthree.setBold(True)
        #font 4
        self.fontfour=QFont('arial')
        self.fontfour.setPointSize(20)
        self.fontfour.setBold(False)

        self.wxtopspace=QLabel()
        self.wxtopspacenumber=70
        self.wxtopspace.setFixedHeight(self.wxtopspacenumber)
        self.wxFrameLayout.addRow(self.wxtopspace)

        toplayout=QHBoxLayout()

        #City label
        self.flightcat=QLabel()
        self.flightcat.setStyleSheet('color: white; background-color: rgba(0,120,0,0)')
        self.flightcat.setPixmap(self.vfricon)
        self.flightcat.setAlignment(Qt.AlignRight)
        self.flightcat.setFixedHeight(25)
        self.flightcat.hide()
        # self.flightcatshadow=QGraphicsDropShadowEffect()
        # self.flightcatshadow.setBlurRadius(30)
        # self.flightcatshadow.setColor(Qt.black)
        # self.flightcatshadow.setOffset(5, -3)
        # self.flightcat.setGraphicsEffect(self.flightcatshadow)
        toplayout.addWidget(self.flightcat)
        
        self.citylabel=QLabel()
        self.fontfour.setBold(True)
        self.citylabel.setFont(self.fontfour)
        self.fontfour.setBold(False)
        self.citylabel.setStyleSheet('color: white; background-color: rgba(120,0,0,0)')
        self.citylabel.setAlignment(Qt.AlignLeft)
        toplayout.addWidget(self.citylabel)

        topspace=QLabel()
        topspace.setStyleSheet('color: white; background-color: rgba(0,0,120,0)')
        toplayout.addWidget(topspace)
        
        self.wxFrameLayout.addRow(toplayout)

        #self.wxFrameLayout.addRow(self.citylabel,self.flightcat)
        
        #set up the frame to put the current wx data in
        self.wxdataFrame=QHBoxLayout()
        self.wxdataleft=QWidget()
        self.wxdataleft.setFixedWidth(175)
        self.leftframelayout=QFormLayout()
        self.wxdataleft.setLayout(self.leftframelayout)
        self.wxdataright=QWidget()
        self.wxdataright.setFixedWidth(360)
        self.rightframelayout=QFormLayout()
        self.rightframelayout.setSpacing(0)
        self.rightframelayout.setContentsMargins(0, 0, 0, 0)
        self.wxdataright.setLayout(self.rightframelayout)
        self.wxdataFrame.addWidget(self.wxdataleft)
        self.wxdataFrame.addWidget(self.wxdataright)
        self.wxFrameLayout.addRow(self.wxdataFrame)

        #Temp label
        self.templabel=QLabel("--" + u'\N{DEGREE SIGN}')
        self.templabel.setFont(self.fontthree)
        self.templabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.templabel.setAlignment(Qt.AlignCenter)
        self.leftframelayout.addRow(self.templabel)

        #Conditions label
        self.wxlabel=QLabel()
        self.wxlabel.setFont(self.fontfour)
        self.wxlabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.wxlabel.setAlignment(Qt.AlignCenter)
        self.leftframelayout.addRow(self.wxlabel)
        
        #Right side with the rest of the data
        self.fonttwo.setPointSize(16)
        self.humiditylabel=QLabel("Humidity")
        self.humiditylabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(False)
        self.humiditylabel.setFont(self.fonttwo)
        self.humidity=QLabel("NA")
        self.humidity.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(True)
        self.humidity.setFont(self.fonttwo)
        self.windlabel=QLabel("Wind")
        self.windlabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(False)
        self.windlabel.setFont(self.fonttwo)
        self.wind=QLabel("NA")
        self.wind.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(True)
        self.wind.setFont(self.fonttwo)
        self.pressurelabel=QLabel("Pressure")
        self.pressurelabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(False)
        self.pressurelabel.setFont(self.fonttwo)
        self.pressure=QLabel("NA")
        self.pressure.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(True)
        self.pressure.setFont(self.fonttwo)
        self.dewlabel=QLabel("Dewpoint")
        self.dewlabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(False)
        self.dewlabel.setFont(self.fonttwo)
        self.dew=QLabel("NA")
        self.dew.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(True)
        self.dew.setFont(self.fonttwo)
        self.feelslikelabel=QLabel("Feels Like")
        self.feelslikelabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(False)
        self.feelslikelabel.setFont(self.fonttwo)
        self.feelslike=QLabel("--")
        self.feelslike.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(True)
        self.feelslike.setFont(self.fonttwo)
        self.vislabel=QLabel("Visibility")
        self.vislabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(False)
        self.vislabel.setFont(self.fonttwo)
        self.vislabel.setFixedWidth(75)
        self.vis=QLabel("NA")
        self.vis.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(True)
        self.vis.setFont(self.fonttwo)
        self.ceilinglabel=QLabel("Ceiling")
        self.ceilinglabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.ceilinglabel.setFixedWidth(75)
        self.fonttwo.setBold(False)
        self.ceilinglabel.setFont(self.fonttwo)
        self.ceiling=QLabel("NA")
        self.ceiling.setStyleSheet('color: white; background-color: rgba(0,0,0,0); border: 0px solid; border-radius: 0px; padding-top:3px; padding-bottom:3px;')
        self.fonttwo.setBold(True)
        self.ceiling.setFont(self.fonttwo)
        self.fonttwo.setBold(False)
        self.fonttwo.setPointSize(14)

        self.rightframelayout.addRow(self.feelslikelabel, self.feelslike)
        self.rightframelayout.addRow(self.dewlabel, self.dew)
        self.rightframelayout.addRow(self.humiditylabel, self.humidity)
        self.rightframelayout.addRow(self.windlabel, self.wind)
        self.rightframelayout.addRow(self.pressurelabel, self.pressure)
        self.rightframelayout.addRow(self.vislabel, self.vis)
        self.rightframelayout.addRow(self.ceilinglabel, self.ceiling)

        self.wxupdatetime=QLabel(self.wxFrame)
        self.wxupdatetime.setGeometry(20,335,220,15)#(int x, int y, int w, int h)#275,335,220,15
        self.wxupdatetime.setStyleSheet('color: rgb(166,166,166); background-color: rgba(0,120,0,0)')
        self.wxupdatetime.setAlignment(Qt.AlignLeft)
        font=QFont('arial')
        font.setPointSize(10)
        font.setBold(False)
        font.setItalic(True)
        self.wxupdatetime.setFont(font)
        
        self.fonttwo.setPointSize(12)
        self.fontthree.setPointSize(48)
        self.fontfour.setPointSize(18)
        self.fontfour.setBold(False)
        self.wxlabel.setFont(self.fontfour)
        self.fontfour.setBold(True)
        self.fonttwo.setBold(False)
        self.humiditylabel.setFont(self.fonttwo)
        self.fonttwo.setBold(True)
        self.humidity.setFont(self.fonttwo)
        self.fonttwo.setBold(False)
        self.windlabel.setFont(self.fonttwo)
        self.fonttwo.setBold(True)
        self.wind.setFont(self.fonttwo)
        self.fonttwo.setBold(False)
        self.pressurelabel.setFont(self.fonttwo)
        self.fonttwo.setBold(True)
        self.pressure.setFont(self.fonttwo)
        self.fonttwo.setBold(False)
        self.dewlabel.setFont(self.fonttwo)
        self.fonttwo.setBold(True)
        self.dew.setFont(self.fonttwo)
        self.fonttwo.setBold(False)
        self.feelslikelabel.setFont(self.fonttwo)
        self.fonttwo.setBold(True)
        self.feelslike.setFont(self.fonttwo)
        self.fonttwo.setBold(False)
        self.vislabel.setFont(self.fonttwo)
        self.fonttwo.setBold(True)
        self.vis.setFont(self.fonttwo)
        self.fonttwo.setBold(False)
        self.ceilinglabel.setFont(self.fonttwo)
        self.fonttwo.setBold(True)
        self.ceiling.setFont(self.fonttwo)
        self.fonttwo.setBold(False)
        self.fonttwo.setPointSize(14)
        self.templabel.setFont(self.fontthree)
        
    def changecurrentwx(self):
        if self.sitewxpos > self.siteswxcount:
            self.sitewxpos=0
        #self.siteswx=[site[0], currentwx[1], temp[2], rh[3], wind[4], press[5], dew[6], vis[7],ceiling[8],flightcat[9]]
        if len(self.siteswx[self.sitewxpos][0])>25:
            self.wxtopspace.setFixedHeight(self.wxtopspacenumber-30)
            self.fontfour.setPointSize(18)
            self.fontfour.setBold(True)
            self.citylabel.setFont(self.fontfour)
            self.citylabel.setText(textwrap.fill(self.siteswx[self.sitewxpos][0],25))
        else:
            self.wxtopspace.setFixedHeight(self.wxtopspacenumber)
            self.fontfour.setPointSize(20)
            self.fontfour.setBold(True)
            self.citylabel.setFont(self.fontfour)
            self.citylabel.setText(self.siteswx[self.sitewxpos][0])
        self.wxlabel.setText(textwrap.fill(self.siteswx[self.sitewxpos][1],10))
        if self.siteswx[self.sitewxpos][2]=="N/A":
            self.templabel.setText("--" + u'\N{DEGREE SIGN}')
        else:
            self.templabel.setText(self.siteswx[self.sitewxpos][2] + u'\N{DEGREE SIGN}')
        self.humidity.setText(self.siteswx[self.sitewxpos][3])
        self.wind.setText(self.siteswx[self.sitewxpos][4])
        self.pressure.setText(self.siteswx[self.sitewxpos][5])
        self.dew.setText(self.siteswx[self.sitewxpos][6] + u'\N{DEGREE SIGN}')
        self.feelslike.setText(self.siteswx[self.sitewxpos][11] + u'\N{DEGREE SIGN}')
        self.vis.setText(self.siteswx[self.sitewxpos][7])
        self.ceiling.setText(textwrap.fill(self.siteswx[self.sitewxpos][8],15))
        self.wxupdatetime.setText(self.siteswx[self.sitewxpos][10])
        if self.siteswx[self.sitewxpos][9]=="VFR":
            self.flightcat.setPixmap(self.vfricon)
            self.flightcat.show()
        elif self.siteswx[self.sitewxpos][9]=="MVFR":
            self.flightcat.setPixmap(self.mvfricon)
            self.flightcat.show()
        elif self.siteswx[self.sitewxpos][9]=="IFR":
            self.flightcat.setPixmap(self.ifricon)
            self.flightcat.show()
        elif self.siteswx[self.sitewxpos][9]=="LIFR":
            self.flightcat.setPixmap(self.lifricon)
            self.flightcat.show()
        else:
            self.flightcat.hide()
        try:
            if float(self.siteswx[self.sitewxpos][7].replace('+',''))<=5 and float(self.siteswx[self.sitewxpos][7].replace('+',''))>=3:
                self.vislabel.setStyleSheet('color:  rgb(38,38,38); background-color: rgb(255,192,0)')
            elif float(self.siteswx[self.sitewxpos][7].replace('+',''))<3 and float(self.siteswx[self.sitewxpos][7].replace('+',''))>=1:
                self.vislabel.setStyleSheet('color: white; background-color: rgb(255,0,0)')
            elif float(self.siteswx[self.sitewxpos][7].replace('+',''))<1:
                self.vislabel.setStyleSheet('color: white; background-color: rgb(255,0,255)')
            else:
                self.vislabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        except:
            self.vislabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        try:
            cig=re.split(' ',self.siteswx[self.sitewxpos][8])
            catlist=[]
            for i in cig:
                if i[0:3]=='OVC' or i[0:3]=='BKN' or i[0:3]=='VV':
                    if int(i[3:6])<=30 and int(i[3:6])>=10:
                        catlist.append(3)
                    elif int(i[3:6])<10 and int(i[3:6])>=5:
                        catlist.append(2)
                    elif int(i[3:6])<5:
                        catlist.append(1)
                    else:
                        catlist.append(4)
            if min(catlist)==3:
                self.ceilinglabel.setStyleSheet('color:  rgb(38,38,38); background-color: rgb(255,192,0)')
            elif min(catlist)==2:
                self.ceilinglabel.setStyleSheet('color: white; background-color: rgb(255,0,0)')
            elif min(catlist)==1:
                self.ceilinglabel.setStyleSheet('color: white; background-color: rgb(255,0,255)')
            else:
                self.ceilinglabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        except:
            #print(traceback.format_exc())
            self.ceilinglabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        self.sitewxpos=self.sitewxpos+1
        
    def updatecurrentwx(self, currentwx, tafdata):
        try:
            self.siteswx=currentwx
            if len(self.siteswx)==0:
                self.siteswx=[["", '', '--', '--', '--', '--', '--', '--','--',None,"",'--']]
                self.sitewxpos=0
            self.siteswxcount=len(self.siteswx)-1
            if self.siteswxcount==0:
                self.citylabel.setText(self.siteswx[self.sitewxpos][0])
                self.wxlabel.setText(self.siteswx[self.sitewxpos][1])
                self.templabel.setText(self.siteswx[self.sitewxpos][2] + u'\N{DEGREE SIGN}')
                self.humidity.setText(self.siteswx[self.sitewxpos][3])
                self.wind.setText(self.siteswx[self.sitewxpos][4])
                self.pressure.setText(self.siteswx[self.sitewxpos][5])
                self.dew.setText(self.siteswx[self.sitewxpos][6] + u'\N{DEGREE SIGN}')
                self.feelslike.setText(self.siteswx[self.sitewxpos][11] + u'\N{DEGREE SIGN}')
                self.vis.setText(self.siteswx[self.sitewxpos][7])
                self.ceiling.setText(textwrap.fill(self.siteswx[self.sitewxpos][8],15))
                self.wxupdatetime.setText(self.siteswx[self.sitewxpos][10])
                if self.siteswx[self.sitewxpos][9]=="VFR":
                    self.flightcat.setPixmap(self.vfricon)
                    self.flightcat.show()
                elif self.siteswx[self.sitewxpos][9]=="MVFR":
                    self.flightcat.setPixmap(self.mvfricon)
                    self.flightcat.show()
                elif self.siteswx[self.sitewxpos][9]=="IFR":
                    self.flightcat.setPixmap(self.ifricon)
                    self.flightcat.show()
                elif self.siteswx[self.sitewxpos][9]=="LIFR":
                    self.flightcat.setPixmap(self.lifricon)
                    self.flightcat.show()
                else:
                    self.flightcat.hide()
                try:
                    if float(self.siteswx[self.sitewxpos][7].replace('+',''))<=5 and float(self.siteswx[self.sitewxpos][7].replace('+',''))>=3:
                        self.vislabel.setStyleSheet('color:  rgb(38,38,38); background-color: rgb(255,192,0)')
                    elif float(self.siteswx[self.sitewxpos][7].replace('+',''))<3 and float(self.siteswx[self.sitewxpos][7].replace('+',''))>=1:
                        self.vislabel.setStyleSheet('color: white; background-color: rgb(255,0,0)')
                    elif float(self.siteswx[self.sitewxpos][7].replace('+',''))<1:
                        self.vislabel.setStyleSheet('color: white; background-color: rgb(255,0,255)')
                    else:
                        self.vislabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
                except:
                    self.vislabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
                try:
                    cig=re.split(' ',self.siteswx[self.sitewxpos][8])
                    catlist=[]
                    for i in cig:
                        if i[0:3]=='OVC' or i[0:3]=='BKN' or i[0:3]=='VV':
                            if int(i[3:6])<=30 and int(i[3:6])>=10:
                                catlist.append(3)
                            elif int(i[3:6])<10 and int(i[3:6])>=5:
                                catlist.append(2)
                            elif int(i[3:6])<5:
                                catlist.append(1)
                            else:
                                catlist.append(4)
                    if min(catlist)==3:
                        self.ceilinglabel.setStyleSheet('color:  rgb(38,38,38); background-color: rgb(255,192,0)')
                    elif min(catlist)==2:
                        self.ceilinglabel.setStyleSheet('color: white; background-color: rgb(255,0,0)')
                    elif min(catlist)==1:
                        self.ceilinglabel.setStyleSheet('color: white; background-color: rgb(255,0,255)')
                    else:
                        self.ceilinglabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
                except:
                    #print(traceback.format_exc())
                    self.ceilinglabel.setStyleSheet('color: white; background-color: rgba(0,0,0,0)')
        except:
            self.siteswx=[["", '', '--', '--', '--', '--', '--', '--','--',None,"",'--']]
            self.sitewxpos=0
        
    #get DT temp data from weather.gov
    def updateDTTemp(self, temp):
        self.dtsactemp.setText(str(temp) + u'\N{DEGREE SIGN}')
        if self.getcurrentwxThread.isRunning():
            pass
        else:
            self.getcurrentwxThread.start()
            
    def updatewarningdata(self, warning, watch, advisory):
        warningold=self.warnings
        warningoldnum=self.warningcount+1
        self.warnings=warning[1]
        self.warningnum=warning[0]
        watchold=self.watches
        watcholdnum=self.watchcount+1
        self.watches=watch[1]
        self.watchnum=watch[0]
        advisoryold=self.advisories
        advisoryoldnum=self.advisorycount+1
        self.advisories=advisory[1]
        self.advisorynum=advisory[0]
        #Set up warnings
        if self.warningnum==0:
            self.warnings=["None"]
            self.warningcount=len(self.warnings)-1
            self.numwarninglabel.setStyleSheet('color: rgb(102,255,51)')#colors are Green (102,255,51) and Red (255,0,0)
            self.numwarninglabel.setText("0")
        elif self.warnings[0]=='NA':
            self.warningcount=len(self.warnings)-1
            self.numwarninglabel.setStyleSheet('color: rgb(102,255,51)')#colors are Green (102,255,51) and Red (255,0,0)
            self.numwarninglabel.setText("--")
        else:
            self.numwarninglabel.setStyleSheet('color: rgb(255,0,0)')#colors are Green (102,255,51) and Red (255,0,0)
            self.numwarninglabel.setText(str(self.warningnum))
            self.warningcount=len(self.warnings)-1
        #Set up watches
        if self.watchnum==0:
            self.watches=["None"]
            self.watchcount=len(self.watches)-1
            self.numwatchlabel.setStyleSheet('color: rgb(102,255,51)')#colors are Green (102,255,51) and light Red (217,150,148)
            self.numwatchlabel.setText("0")
        elif self.watches[0]=='NA':
            self.watchcount=len(self.watches)-1
            self.numwatchlabel.setStyleSheet('color: rgb(102,255,51)')#colors are Green (102,255,51) and light Red (217,150,148)
            self.numwatchlabel.setText("--")
        else:
            self.numwatchlabel.setStyleSheet('color: rgb(217,150,148)')#colors are Green (102,255,51) and light Red (217,150,148)
            self.numwatchlabel.setText(str(self.watchnum))
            self.watchcount=len(self.watches)-1
        #Set up advisory
        if self.advisorynum==0:
            self.advisories=["None"]
            self.advisorycount=len(self.advisories)-1
            self.numadvisorylabel.setStyleSheet('color: rgb(102,255,51)')#colors are Green (102,255,51) and yellow (255,192,0)
            self.numadvisorylabel.setText("0")
        elif self.advisories[0]=='NA':
            self.advisorycount=len(self.advisories)-1
            self.numadvisorylabel.setStyleSheet('color: rgb(102,255,51)')#colors are Green (102,255,51) and yellow (255,192,0)
            self.numadvisorylabel.setText("--")
        else:
            self.numadvisorylabel.setStyleSheet('color: rgb(255,192,0)')#colors are Green (102,255,51) and yellow (255,192,0)
            self.numadvisorylabel.setText(str(self.advisorynum))
            self.advisorycount=len(self.advisories)-1
            
    def changewarningdata(self):
        #move warning data
        if self.warningpos > self.warningcount:
            self.warningpos=0
        self.warninglabel.setText(self.warnings[self.warningpos])
        self.warningpos=self.warningpos+1
        if self.watchpos > self.watchcount:
            self.watchpos=0
        self.watchlabel.setText(self.watches[self.watchpos])
        self.watchpos=self.watchpos+1
        if self.advisorypos > self.advisorycount:
            self.advisorypos=0
        self.advisorylabel.setText(self.advisories[self.advisorypos])
        self.advisorypos=self.advisorypos+1
        
    def updateGIS(self, errorlist):
        print(errorlist)
        self.gisthreadcount=0
        self.GISerrorWindow.hide()
        self.downloadlabel.hide()
        self.canvas.freeze(False)
        self.canvas.refreshAllLayers()
        if len(errorlist)>0:
            self.GISerrorWindow.show()
            if len(errorlist)>3:
                text="Unable to update multiple layers"
            else:
                text=''
                count=0
                for i in errorlist:
                    if count==0:
                        text=i
                    else:
                        text=text + ', ' + i
                    count=count+1
                if len(errorlist)==1:
                    text='Unable to update ' + text + ' layer'
                else:
                    text='Unable to update ' + text + ' layers'
            self.GISerrorlabel.setText(text)
            
class GetDTTemp(QThread):
    singnal=pyqtSignal('PyQt_PyObject')
    def __init__(self, site):
        QThread.__init__(self)
        self.site=site

    def __del__(self):
        self.wait()

    def run(self):
        dttemp="--"
        try:
            metar=urllib.request.urlopen("https://aviationweather.gov/cgi-bin/data/dataserver.php?requestType=retrieve&dataSource=metars&requestType=retrieve&format=xml&hoursBeforeNow=2&mostRecent=true&stationString=" + self.site, timeout=5).read().decode('utf-8')
        except:
            print(traceback.format_exc())
        try:
            dttemp=re.split('</temp_c>',re.split('<temp_c>',metar)[1])[0]
            dttemp=str(round((float(dttemp)*9/5) + 32,0)).replace(".0","")
        except:
            dttemp="--"
        self.singnal.emit(dttemp)
        
class GetCurrentWX(QThread):
    singnal=pyqtSignal('PyQt_PyObject', 'PyQt_PyObject')
    def __init__(self, sites, tafsites,utcoffsetdaylight,utcoffsetstandard):
        QThread.__init__(self)
        self.sites=sites
        self.tafsites=tafsites
        self.utcoffsetdaylight=utcoffsetdaylight
        self.utcoffsetstandard=utcoffsetstandard

    def __del__(self):
        self.wait()

    def run(self):
        siteswx=[]
        tafdata=[]
        for i in self.sites:
            error=0
            try:
                data=urllib.request.urlopen('https://api.weather.gov/stations/' + i, timeout=5).read().decode('utf-8')
            except:
                time.sleep(10)
                try:
                    data=urllib.request.urlopen('https://api.weather.gov/stations/' + i, timeout=5).read().decode('utf-8')
                except:
                    print(traceback.format_exc())
                    error=1
            try:
                stationname=re.split('"timeZone"',re.split('"name": ',data)[1])[0].replace('"','').replace('\n','').replace('  ','')
                stationname=stationname[:len(stationname)-1].replace('  ','')
            except:
                stationname=""
            try:
                apidata=urllib.request.urlopen("https://api.weather.gov/stations/" + i + "/observations/latest", timeout=5).read().decode('utf-8')
            except:
                print(traceback.format_exc())
                time.sleep(10)
                try:
                    apidata=urllib.request.urlopen("https://api.weather.gov/stations/" + i + "/observations/latest", timeout=5).read().decode('utf-8')
                except:
                    error=1
            try:
                metar=urllib.request.urlopen("https://aviationweather.gov/cgi-bin/data/dataserver.php?requestType=retrieve&dataSource=metars&requestType=retrieve&format=xml&hoursBeforeNow=2&mostRecent=true&stationString=" + i, timeout=5).read().decode('utf-8')
            except:
                print(traceback.format_exc())
                time.sleep(10)
                try:
                    metar=urllib.request.urlopen("https://aviationweather.gov/cgi-bin/data/dataserver.php?requestType=retrieve&dataSource=metars&requestType=retrieve&format=xml&hoursBeforeNow=2&mostRecent=true&stationString=" + i, timeout=5).read().decode('utf-8')
                except:
                    error=1
            if error==0:
                try:
                    fellslike='--'
                    updatetime=re.split('</observation_time>',re.split('<observation_time>',metar)[1])[0]
                    updatetime=datetime.strptime(updatetime, '%Y-%m-%dT%H:%M:%SZ')
                    deltatime=datetime.utcnow()-updatetime
                    timeago=re.split(':',str(deltatime))
                    self.daylightsaving()
                    updatetime=updatetime+timedelta(hours=self.lautcoffset)
                    updatetime=format(updatetime, 'Updated: %m/%d %I:%M %p')
                    if 'day' in timeago[0] or 'days' in timeago[0]:
                        seconds=86400
                    elif int(timeago[0])>0:
                        seconds=int(timeago[0])*3600
                    else:
                        seconds=int(timeago[1])*60
                except:
                    #print(i)
                    #print(traceback.format_exc())
                    #print(metar)
                    seconds=7800
                if seconds<7300:
                    try:
                        rawmetar=re.split('</raw_text>',re.split('<raw_text>',metar)[1])[0]
                    except:
                        rawmetar=None
                    try:
                        currentwx=re.split(',',re.split('"textDescription": ',apidata)[1])[0].replace('"','').replace('\n','')
                    except:
                        #print(rawmetar)
                        #print(traceback.format_exc())
                        currentwx=""
                    try:
                        temp=re.split('</temp_c>',re.split('<temp_c>',metar)[1])[0]
                        temp=str(round((float(temp)*9/5) + 32,0)).replace(".0","")
                    except:
                        temp="--"
                    try:
                        heatindex=re.split(',',re.split('"heatIndex": {',apidata)[1])[1].replace('"value": ',"")
                        heatindex=str(round((float(heatindex)*9/5) + 32,0)).replace(".0","")
                    except:
                        #print(traceback.format_exc())
                        heatindex="--"
                    try:
                        windchill=re.split(',',re.split('"windChill": {',apidata)[1])[1].replace('"value": ',"")
                        windchill=str(round((float(windchill)*9/5) + 32,0)).replace(".0","")
                    except:
                        windchill="--"
                        #print(rawmetar)
                        #print(traceback.format_exc())
                    if heatindex!='--':
                        fellslike=heatindex
                    elif windchill!='--':
                        fellslike=windchill
                    else:
                        fellslike=temp
                    try:
                        dewpoint=re.split('</dewpoint_c>',re.split('<dewpoint_c>',metar)[1])[0]
                        dewpoint=str(round((float(dewpoint)*9/5) + 32,0)).replace(".0","")
                    except:
                        dewpoint="--"
                        #print(rawmetar)
                        #print(traceback.format_exc())
                    try:
                        try:
                            winddir=re.split('</wind_dir_degrees>',re.split('<wind_dir_degrees>',metar)[1])[0]
                            winddir=self.wind_deg_to_dir(winddir)
                        except:
                            winddir=""
                        windspeed=re.split('</wind_speed_kt>',re.split('<wind_speed_kt>',metar)[1])[0]
                        windspeed=str(round(int(windspeed)*1.150779,0)).replace(".0","")
                        if '<wind_gust_kt>' in metar:
                            windgust=re.split('</wind_gust_kt>',re.split('<wind_gust_kt>',metar)[1])[0]
                            windgust=str(round(int(windgust)*1.150779,0)).replace(".0","")
                            wind=winddir + " " + windspeed + " G " + windgust + " MPH"
                        else:
                            wind=winddir + " " + windspeed + " MPH"
                    except:
                        wind="--"
                        #print(rawmetar)
                        #print(traceback.format_exc())
                    try:
                        vis=re.split('</visibility_statute_mi>',re.split('<visibility_statute_mi>',metar)[1])[0]
                    except:
                        vis="--"
                        #print(rawmetar)
                        #print(traceback.format_exc())
                    try:
                        pressureinhg=re.split('</altim_in_hg>',re.split('<altim_in_hg>',metar)[1])[0]
                        if '<sea_level_pressure_mb>' in metar:
                            pressuremb=re.split('</sea_level_pressure_mb>',re.split('<sea_level_pressure_mb>',metar)[1])[0]
                            pressure=str(round(float(pressureinhg),2)) + " in (" + pressuremb + " mb)"
                        else:
                            pressuremb=str(round(float(pressureinhg)*33.8637526,1))
                            pressure=str(round(float(pressureinhg),2)) + " in (" + pressuremb + " mb)"
                    except:
                        pressure="--"
                        #print(rawmetar)
                        #print(traceback.format_exc())
                    try:
                        #humidity=re.split(',',re.split('    "relativeHumidity": {',apidata)[1])[0].replace('"','').replace('value: ','').replace(' ','').replace('\n','')
                        #humidity=str(round(float(humidity),0)).replace(".0","") + "%"
                        #print(humidity)
                        Tc=5.0/9.0*(float(temp)-32.0)
                        Tdc=5.0/9.0*(float(dewpoint)-32.0)
                        Es=6.11*10.0**(7.5*Tc/(237.7+Tc))
                        E=6.11*10.0**(7.5*Tdc/(237.7+Tdc))
                        humidity=round((E/Es)*100,0)
                        if humidity>100:
                            humidity="100%"
                        else:
                            humidity=str(humidity).replace(".0","") + "%"
                    except:
                        humidity="--"
                        #print(rawmetar)
                        #print(traceback.format_exc())
                    try:
                        flightcat=re.split('</flight_category>',re.split('<flight_category>',metar)[1])[0]
                    except:
                        flightcat=None
                    if i[1:] in self.tafsites:
                        tafdata.append([i, flightcat])
                    try:
                        cigs=re.split(" ",rawmetar)
                        ciglist=[]
                        for i in cigs:
                            if "VV" in i:
                                ciglist.append(i)
                            if "OVC" in i:
                                ciglist.append(i)
                            if "BKN" in i:
                                ciglist.append(i)
                            if "SCT" in i:
                                ciglist.append(i)
                            if "FEW" in i:
                                ciglist.append(i)
                        if len(ciglist)>=1:
                            count=0
                            for i in ciglist:
                                if count==0:
                                    ceiling=i
                                else:
                                    ceiling=ceiling + " " + i
                                count=count+1
                        else:
                            ceiling="None"
                    except:
                        ceiling="NA"
                        #print(rawmetar)
                        #print(traceback.format_exc())
                    siteswx.append([stationname,currentwx,temp,humidity,wind,pressure,dewpoint,vis,ceiling,flightcat,updatetime,fellslike])
                else:
                    #print(i)
                    #print(deltatime)
                    #print(timeago)
                    #print(seconds)
                    if i[1:] in self.tafsites:
                        tafdata.append([i, None])
            else:
                if i[1:] in self.tafsites:
                    tafdata.append([i, None])
        self.singnal.emit(siteswx, tafdata)                        
    def wind_deg_to_dir(self, deg):
            arr = ['NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N']
            return arr[int(abs((int(deg) - 11.25) % 360)/ 22.5)]

    def daylightsaving(self):
        #LA
        if datetime.utcnow()>datetime.strptime("3/"+str(calendar.monthcalendar(int(format(datetime.utcnow(), '%y')),3)[1][6])+"/"+str(format(datetime.utcnow(), '%y'))+"-10","%m/%d/%y-%H") and datetime.utcnow()<datetime.strptime("11/"+str(calendar.monthcalendar(int(format(datetime.utcnow(), '%y')),11)[0][6])+"/"+str(format(datetime.utcnow(), '%y'))+"-9","%m/%d/%y-%H"):#in daylight saving
            self.lautcoffset=self.utcoffsetdaylight
        else:#out of daylight saving
            self.lautcoffset=self.utcoffsetstandard
            
class GetWarnings(QThread):
    singnal=pyqtSignal('PyQt_PyObject','PyQt_PyObject','PyQt_PyObject')
    def __init__(self, zones):
        QThread.__init__(self)
        self.zones=zones

    def __del__(self):
        self.wait()

    def run(self):
        try:
            watch=[]
            warning=[]
            advisory=[]
            prodvtecs=[]
            count=0
            for i in self.zones:
                if count==0:
                    zones=i
                else:
                    zones=zones + ',' + i
                count=count+1
            try:
                #data=urllib.request.urlopen('https://api.weather.gov/alerts/active?zone=' + zones + "&urgency=unknown,future,expected,immediate", timeout=5).read().decode('utf-8')
                data=urllib.request.urlopen('https://api.weather.gov/alerts/active?zone=' + zones, timeout=5).read().decode('utf-8')
                #data2=urllib.request.urlopen('https://api.weather.gov/alerts/active/area/CA', timeout=5).read().decode('utf-8')
                #datalist=[data1]
            except:
                print(traceback.format_exc())
                time.sleep(10)
                try:
                   #data=urllib.request.urlopen('https://api.weather.gov/alerts/active?zone=' + zones + "&urgency=unknown,future,expected,immediate", timeout=5).read().decode('utf-8')
                   data=urllib.request.urlopen('https://api.weather.gov/alerts/active?zone=' + zones, timeout=5).read().decode('utf-8')
                   #data2=urllib.request.urlopen('https://api.weather.gov/alerts/active/area/CA', timeout=5).read().decode('utf-8')
                   #datalist=[data1]
                except:
                    print(traceback.format_exc())
                    watch=["NA"]
                    warning=["NA"]
                    advisory=["NA"]
                    self.singnal.emit(['--', warning],['--',watch],['--',advisory])
                    return

            events=re.split('"id": "https://',data)[1:]
            for i in events:
                try:
                    product=re.split('",',re.split('"event": "',i)[1])[0]
                    try:
                        issuedtime=re.split('",',re.split('"sent": "',i)[2])[0]
                    except:
                        issuedtime=re.split('",',re.split('"sent": "',i)[1])[0]
                    expiretime=re.split('",',re.split('"expires": "',i)[1])[0]
                    sender=re.split('",',re.split('"senderName": "',i)[1])[0]
                    identifier=re.split('",',re.split('"id": "',i)[1])[0]
                    if "Warning" in product:
                        prodvtecs.append(identifier)
                        warning.append(product)
                    if "Watch" in product:
                        prodvtecs.append(identifier)
                        watch.append(product)
                    if "Advisory" in product:
                        prodvtecs.append(identifier)
                        advisory.append(product)
                except:
                    #print(traceback.format_exc())
                    pass

            numwarnings=len(warning)
            numwatches=len(watch)
            numadvisories=len(advisory)

            if len(warning)>=2:
                warninglist=[]
                my_dict = {i:warning.count(i) for i in warning}
                warning=re.split(',',str(my_dict))
                for i in warning:
                    prod=re.split(': ',i)
                    if int(prod[1].replace("'",'').replace('{','').replace('}',''))>1:
                        warninglist.append(prod[0].replace("'",'').replace('{','').replace('}','').lstrip() + ' (' + prod[1].replace("'",'').replace('{','').replace('}','') + ')')
                    else:
                        warninglist.append(prod[0].replace("'",'').replace('{','').replace('}','').lstrip())
                warning=warninglist

            if len(watch)>=2:
                watchlist=[]
                my_dict = {i:watch.count(i) for i in watch}
                watch=re.split(',',str(my_dict))
                for i in watch:
                    prod=re.split(': ',i)
                    if int(prod[1].replace("'",'').replace('{','').replace('}',''))>1:
                        watchlist.append(prod[0].replace("'",'').replace('{','').replace('}','').lstrip() + ' (' + prod[1].replace("'",'').replace('{','').replace('}','') + ')')
                    else:
                        watchlist.append(prod[0].replace("'",'').replace('{','').replace('}','').lstrip())
                watch=watchlist

            if len(advisory)>=2:
                advisorylist=[]
                my_dict = {i:advisory.count(i) for i in advisory}
                advisory=re.split(',',str(my_dict))
                for i in advisory:
                    prod=re.split(': ',i)
                    if int(prod[1].replace("'",'').replace('{','').replace('}',''))>1:
                        advisorylist.append(prod[0].replace("'",'').replace('{','').replace('}','').lstrip() + ' (' + prod[1].replace("'",'').replace('{','').replace('}','') + ')')
                    else:
                        advisorylist.append(prod[0].replace("'",'').replace('{','').replace('}','').lstrip())
                advisory=advisorylist
            self.singnal.emit([numwarnings, warning],[numwatches,watch],[numadvisories,advisory])
        except:
            print(traceback.format_exc())
            watch=["NA"]
            warning=["NA"]
            advisory=["NA"]
            self.singnal.emit(['--', warning],['--',watch],['--',advisory])
            
class GetGISData(QThread):
    singnal=pyqtSignal('PyQt_PyObject')
    def __init__(self, startup, canvas, gispath, folderpath):
        QThread.__init__(self)
        self.startup=startup #1=update all files
        self.canvas=canvas
        self.wwaerror=0
        self.GISpath=gispath
        self.folderpath=folderpath
        self.errorlist=[]

    def __del__(self):
        self.wait()
        
    def stop(self):
        self.terminate()

    def run(self):
        self.min=time.strftime('%H%M', time.gmtime())
        #Stuff to update every 5 min. Radar and WAA data
        if self.min.endswith('0') or self.min.endswith('5') or self.startup==1:
            try:
                #urllib.request.urlretrieve("https://mrms.ncep.noaa.gov/data/2D/MergedBaseReflectivityQC/MRMS_MergedBaseReflectivityQC.latest.grib2.gz", self.GISpath + "MRMS\MRMS_MergedBaseReflectivityQC.latest.grib2.gz")
                r = requests.get("https://mrms.ncep.noaa.gov/data/2D/MergedBaseReflectivityQC/MRMS_MergedBaseReflectivityQC.latest.grib2.gz", allow_redirects=True, timeout=15)
                with open(self.GISpath + "MRMS\MRMS_MergedBaseReflectivityQC.latest.grib2.gz", 'wb') as f:
                    f.write(r.content)
                f.close()
                self.canvas.freeze(True)
                #self.windowtwo.freezecanvas()
                with gzip.open(self.GISpath + 'MRMS\MRMS_MergedBaseReflectivityQC.latest.grib2.gz', 'rb') as f_in:
                    with open(self.GISpath + 'MRMS\MRMS_MergedBaseReflectivityQC.latest.grib2', 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                time.sleep(.5)
                self.canvas.freeze(False)
                #self.windowtwo.unfreezecanvas()
            except:
                print("Error getting MRMS, sleeping then trying again")
                try:
                    r = requests.get("https://mrms.ncep.noaa.gov/data/2D/MergedBaseReflectivityQC/MRMS_MergedBaseReflectivityQC.latest.grib2.gz", allow_redirects=True, timeout=15)
                    with open(self.GISpath + "MRMS\MRMS_MergedBaseReflectivityQC.latest.grib2.gz", 'wb') as f:
                        f.write(r.content)
                    f.close()
                    self.canvas.freeze(True)
                    #self.windowtwo.freezecanvas()
                    with gzip.open(self.GISpath + 'MRMS\MRMS_MergedBaseReflectivityQC.latest.grib2.gz', 'rb') as f_in:
                        with open(self.GISpath + 'MRMS\MRMS_MergedBaseReflectivityQC.latest.grib2', 'wb') as f_out:
                            shutil.copyfileobj(f_in, f_out)
                    time.sleep(.5)
                    self.canvas.freeze(False)
                except:
                    print("Unable to update MRMS")
                    self.errorlist.append('MRMS')              
            try:
                self.makePrecipMask()
            except:
                print("Error getting MRMS Precip")
                self.errorlist.append('MRMS Precip Type')
                print(traceback.format_exc())
            try:
                self.getdetailedWWA()
            except:
                self.errorlist.append('WWA')
            self.getLSR()
            self.getMDs()
            self.getMPDs()
            print('start outlook')
            self.getoutlooks()
            print('end outlook')

        #Stuff to udate every 10 min. River, CalFire and Caltrans data
        if self.min.endswith('0') or self.startup==1:
            try:
                #print('getting rfc')
                #urllib.request.urlretrieve("https://water.weather.gov/ahps/download.php?data=tgz_fcst_ffep", self.GISpath + "RFC\\national_shapefile_fcst_ffep.tgz")
                r = requests.get("https://water.weather.gov/ahps/download.php?data=tgz_fcst_ffep", allow_redirects=True, timeout=15)
                with open(self.GISpath + "RFC\\national_shapefile_fcst_ffep.tgz", 'wb') as f:
                     f.write(r.content)
                f.close()
                self.canvas.freeze(True)
                #self.windowtwo.freezecanvas()
                my_tar = tarfile.open(self.GISpath + 'RFC\\national_shapefile_fcst_ffep.tgz')
                my_tar.extractall(self.GISpath + 'RFC\\') # specify which folder to extract to
                my_tar.close()
                time.sleep(.5)
                self.canvas.freeze(False)
            except:
                self.errorlist.append('River Data')
                print(traceback.format_exc())
                pass               

        #Get GOES data every 10 min on the 5s
        if self.min.endswith('5') or self.startup==1:
            self.canvas.freeze(True)
            #.nc glm file on AWS
            #https://noaa-goes16.s3.amazonaws.com/index.html#GLM-L2-LCFA/2023/
            #NDFD on AWS
            #https://noaa-ndfd-pds.s3.amazonaws.com/index.html#wmo/maxt/2023/05/27/
            #self.windowtwo.freezecanvas()
            try:
                #print('\n\n\n\n\n\n\n\n\n\ngeo')
                #urllib.request.urlretrieve("https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/GEOCOLOR/GOES16-ABI-CONUS-GEOCOLOR-5000x3000.tif", self.GISpath + 'Satellite\GOES16-ABI-CONUS-GEOCOLOR-5000x3000.tif")
                #urllib.request.urlretrieve("https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/GEOCOLOR/GOES16-ABI-FD-GEOCOLOR-10848x10848.tif", self.GISpath + "Satellite\GOES16-ABI-CONUS-GEOCOLOR-5000x3000.tif")
                r = requests.get("https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/GEOCOLOR/GOES16-ABI-FD-GEOCOLOR-10848x10848.tif", allow_redirects=True, timeout=15)
                with open(self.GISpath + "Satellite\GOES16-ABI-CONUS-GEOCOLOR-5000x3000.tif", 'wb') as f:
                     f.write(r.content)
                f.close()
            except:
                print(traceback.format_exc())
                self.errorlist.append('GeoColor Sat')
                pass
            try:
                #print('\n\n\n\n\n\n\n\n\n\nvis')
                #urllib.request.urlretrieve("https://cdn.star.nesdis.noaa.gov/GOES16/ABI/CONUS/02/GOES16-ABI-CONUS-02-GeoTIFF.kmz", self.GISpath + 'Satellite\GOES16-ABI-CONUS-02-GeoTIFF.kmz")
                #urllib.request.urlretrieve("https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/02/GOES16-ABI-FD-02-GeoTIFF.kmz", self.GISpath + "Satellite\GOES16-ABI-CONUS-02-GeoTIFF.kmz")
                r = requests.get("https://cdn.star.nesdis.noaa.gov/GOES16/ABI/FD/02/GOES16-ABI-FD-02-GeoTIFF.kmz", allow_redirects=True, timeout=15)
                with open(self.GISpath + "Satellite\GOES16-ABI-CONUS-02-GeoTIFF.kmz", 'wb') as f:
                     f.write(r.content)
                f.close()
            except:
                print(traceback.format_exc())
                self.errorlist.append('Vis Sat')
                pass
            time.sleep(.5)
            self.canvas.freeze(False)
            #self.windowtwo.unfreezecanvas()
        #self.singnal.emit(self.wwaerror)
        self.singnal.emit(self.errorlist)
        
    def makePrecipMask(self):
        try:
            request=urllib.request.urlopen('https://mrms.ncep.noaa.gov/data/2D/Model_0degC_Height/', timeout=15).read().decode('utf-8')
            updatetime=re.split('  </td><td',re.split('<tr><td><a href="MRMS_Model_0degC_Height.latest.grib2.gz">MRMS_Model_0degC_Height.latest.grib2.gz</a></td><td align="right">',request)[1])[0]
            updatetime=datetime.strptime(updatetime, '%d-%b-%Y %H:%M')
            deltatime=datetime.utcnow()-updatetime
            timeago=re.split(':',str(deltatime))
            if 'day' in timeago[0] or 'days' in timeago[0]:
                seconds=86400
            elif int(timeago[0])>0:
                seconds=int(timeago[0])*3600
            else:
                seconds=int(timeago[1])*60
            if seconds<=600 or self.startup==1:
                r = requests.get("https://mrms.ncep.noaa.gov/data/2D/Model_0degC_Height/MRMS_Model_0degC_Height.latest.grib2.gz", allow_redirects=True, timeout=15)
                with open(self.GISpath + "MRMS\MRMS_Model_0degC_Height.latest.grib2.gz", 'wb') as f:
                    f.write(r.content)
                f.close()
                with gzip.open(self.GISpath + 'MRMS\MRMS_Model_0degC_Height.latest.grib2.gz', 'rb') as f_in:
                    with open(self.GISpath + 'MRMS\MRMS_Model_0degC_Height.latest.grib2', 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                        
            request=urllib.request.urlopen('https://mrms.ncep.noaa.gov/data/2D/Model_WetBulbTemp/', timeout=15).read().decode('utf-8')
            updatetime=re.split('  </td><td',re.split('<tr><td><a href="MRMS_Model_WetBulbTemp.latest.grib2.gz">MRMS_Model_WetBulbTemp.latest.grib2.gz</a></td><td align="right">',request)[1])[0]
            updatetime=datetime.strptime(updatetime, '%d-%b-%Y %H:%M')
            deltatime=datetime.utcnow()-updatetime
            timeago=re.split(':',str(deltatime))
            if 'day' in timeago[0] or 'days' in timeago[0]:
                seconds=86400
            elif int(timeago[0])>0:
                seconds=int(timeago[0])*3600
            else:
                seconds=int(timeago[1])*60
            if seconds<=600 or self.startup==1:
                r = requests.get("https://mrms.ncep.noaa.gov/data/2D/Model_WetBulbTemp/MRMS_Model_WetBulbTemp.latest.grib2.gz", allow_redirects=True, timeout=15)
                with open(self.GISpath + "MRMS\MRMS_Model_WetBulbTemp.latest.grib2.gz", 'wb') as f:
                    f.write(r.content)
                f.close()
                with gzip.open(self.GISpath + 'MRMS\MRMS_Model_WetBulbTemp.latest.grib2.gz', 'rb') as f_in:
                    with open(self.GISpath + 'MRMS\MRMS_Model_WetBulbTemp.latest.grib2', 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
            zeroHeight=QgsRasterLayer(self.GISpath + 'MRMS\MRMS_Model_0degC_Height.latest.grib2', 'raster')
            wetbulb=QgsRasterLayer(self.GISpath + "MRMS\MRMS_Model_WetBulbTemp.latest.grib2", 'raster')
            reflectivity=QgsRasterLayer(self.GISpath + "MRMS\MRMS_MergedBaseReflectivityQC.latest.grib2", 'raster')     
            entries = []

            ras = QgsRasterCalculatorEntry()
            ras.ref = 'zeroheight' 
            ras.raster = zeroHeight
            ras.bandNumber = 1
            entries.append(ras)


            ras = QgsRasterCalculatorEntry()
            ras.ref = 'wetbulb'
            ras.raster = wetbulb
            ras.bandNumber = 1
            entries.append(ras)
            
            ras = QgsRasterCalculatorEntry()
            ras.ref = 'reflectivity'
            ras.raster = reflectivity
            ras.bandNumber = 1
            entries.append(ras)

            calc = QgsRasterCalculator('"zeroheight" <= 1500 AND "reflectivity" >= 5 AND "wetbulb" <=2', self.GISpath + "MRMS\workingsnowmask.tiff", 'GTiff', reflectivity.extent(), reflectivity.width(), reflectivity.height(), entries)
            calc.processCalculation()
            shutil.copyfile(self.GISpath + "MRMS\workingsnowmask.tiff", self.GISpath + "MRMS\snowmask.tiff")
            
            calc = QgsRasterCalculator('"zeroheight" >= 1500 AND "reflectivity" >= 5 AND "wetbulb" >=-2 AND "wetbulb" <=0', self.GISpath + "MRMS\workingicemask.tiff", 'GTiff', reflectivity.extent(), reflectivity.width(), reflectivity.height(), entries)
            calc.processCalculation()
            shutil.copyfile(self.GISpath + "MRMS\workingicemask.tiff", self.GISpath + "MRMS\icemask.tiff")
            
            calc = QgsRasterCalculator('"zeroheight" >= 1500 AND "reflectivity" >= 5 AND "wetbulb" <-2', self.GISpath + "MRMS\workingsleetmask.tiff", 'GTiff', reflectivity.extent(), reflectivity.width(), reflectivity.height(), entries)
            calc.processCalculation()
            shutil.copyfile(self.GISpath + "MRMS\workingsleetmask.tiff", self.GISpath + "MRMS\sleetmask.tiff")
        except:
            print("Error Making Precip Type Mask")
            self.errorlist.append('Precip Type Mask')
            print(traceback.format_exc())
            
    def getLSR(self):
        try:
            #data=urllib.request.urlopen('https://www.spc.noaa.gov/climo/reports/today_filtered.csv', timeout=10).read().decode('utf-8')
            data=urllib.request.urlopen('https://www.spc.noaa.gov/climo/reports/today.csv', timeout=10).read().decode('utf-8')
            data=re.split('\n',data)

            torlist=[]
            windlist=[]
            haillist=[]
            fulllist=[]
            appendlist=''
            addhour = datetime.utcnow() + timedelta(hours=-1)

            for i in data:
                if i !='':
                    if 'F_Scale' in re.split(',',i)[1]:
                        appendlist='tor'
                    elif 'Speed' in re.split(',',i)[1]:
                        appendlist='wind'
                    elif 'Size' in re.split(',',i)[1]:
                        appendlist='hail'
                    else:
                        if appendlist=='tor':
                            torlist.append(i)
                        if appendlist=='wind':
                            windlist.append(i)
                        if appendlist=='hail':
                            haillist.append(i)
            for i in data:
                try:
                    if int(format(datetime.utcnow(), '%H%M'))>100 and int(format(datetime.utcnow(), '%H%M'))<=1215:
                        if int(i[0:4])<1200:
                            if int(i[0:4])>=int(format(addhour, '%H%M')):
                                fulllist.append(i)
                    elif int(format(datetime.utcnow(), '%H%M'))==0:
                        if int(i[0:4])>=2300 or int(i[0:4])<=100:
                            if int(i[0:4])>=int(format(addhour, '%H%M')) or int(i[0:4])<=100:
                                fulllist.append(i)
                    elif int(i[0:4])>=int(format(addhour, '%H%M')):
                        fulllist.append(i)
                except:
                    #print("\n\nLSR new data error error\n\n\n")
                    #print(traceback.format_exc())
                    pass
                          
            oldlsrlist=[]
            try:
                lsrlayerold=QgsVectorLayer(self.GISpath + "Outlooks\\SPC\\Convective\\lsr.shp", "LSR", "ogr")
                for feat in lsrlayerold.getFeatures():
                    oldlsrlist.append(feat.attributes()[0])
            except:
                print("\n\nLSR old data error error\n\n\n")
                print(traceback.format_exc())
                pass

            if int(len(oldlsrlist))!=int(len(fulllist)):
                fields = QgsFields()
                fields.append(QgsField("Type", QVariant.String))
                fields.append(QgsField("Time", QVariant.String))
                fields.append(QgsField("mag", QVariant.String))
                fields.append(QgsField("location", QVariant.String))
                fields.append(QgsField("county", QVariant.String))
                fields.append(QgsField("state", QVariant.String))
                fields.append(QgsField("comments", QVariant.String))
                
                writer = QgsVectorFileWriter(self.GISpath + "Outlooks\\SPC\\Convective\\Workinglsr.shp", "UTF-8", fields,
                                             QgsWkbTypes.Point, QgsCoordinateReferenceSystem("EPSG:4269"), "ESRI Shapefile")

                if writer.hasError() != QgsVectorFileWriter.NoError:
                    print("Error when creating shapefile: ", writer.errorMessage())

                # Add a feature
                fet = QgsFeature()
                wrotetofile=0
                if len(torlist)>0:
                    for i in torlist:
                        elements=re.split(',',i)
                        if int(format(datetime.utcnow(), '%H%M'))>=100 and int(format(datetime.utcnow(), '%H%M'))<=1215:
                            if int(elements[0])<1200:
                                if int(elements[0])>=int(format(addhour, '%H%M')):
                                    wrotetofile=1
                                    point1 = QgsPointXY(float(elements[6].replace('\n','')),float(elements[5].replace('\n','')))
                                    fet.setGeometry(QgsGeometry.fromPointXY(point1))
                                    fet.setAttributes(['Tor',elements[0],elements[1],elements[2],elements[3],elements[4],elements[7]])
                                    writer.addFeature(fet)
                        elif int(format(datetime.utcnow(), '%H%M'))==0:
                            if int(elements[0])>=2300  or int(elements[0])<=100:
                                if int(elements[0])>=int(format(addhour, '%H%M')) or int(elements[0])<=100:
                                    wrotetofile=1
                                    point1 = QgsPointXY(float(elements[6].replace('\n','')),float(elements[5].replace('\n','')))
                                    fet.setGeometry(QgsGeometry.fromPointXY(point1))
                                    fet.setAttributes(['Tor',elements[0],elements[1],elements[2],elements[3],elements[4],elements[7]])
                                    writer.addFeature(fet)
                        elif int(elements[0])>=int(format(addhour, '%H%M')):
                            wrotetofile=1
                            point1 = QgsPointXY(float(elements[6].replace('\n','')),float(elements[5].replace('\n','')))
                            fet.setGeometry(QgsGeometry.fromPointXY(point1))
                            fet.setAttributes(['Tor',elements[0],elements[1],elements[2],elements[3],elements[4],elements[7]])
                            writer.addFeature(fet)
                if len(windlist)>0:
                    for i in windlist:
                        elements=re.split(',',i)
                        if int(format(datetime.utcnow(), '%H%M'))>=100 and int(format(datetime.utcnow(), '%H%M'))<=1215:
                            if int(elements[0])<1200:
                                if int(elements[0])>=int(format(addhour, '%H%M')):
                                    wrotetofile=1
                                    point1 = QgsPointXY(float(elements[6].replace('\n','')),float(elements[5].replace('\n','')))
                                    fet.setGeometry(QgsGeometry.fromPointXY(point1))
                                    fet.setAttributes(['Wind',elements[0],elements[1],elements[2],elements[3],elements[4],elements[7]])
                                    writer.addFeature(fet)
                        elif int(format(datetime.utcnow(), '%H%M'))==0:
                            if int(elements[0])>=2300  or int(elements[0])<=100:
                                if int(elements[0])>=int(format(addhour, '%H%M')) or int(elements[0])<=100:
                                    wrotetofile=1
                                    point1 = QgsPointXY(float(elements[6].replace('\n','')),float(elements[5].replace('\n','')))
                                    fet.setGeometry(QgsGeometry.fromPointXY(point1))
                                    fet.setAttributes(['Wind',elements[0],elements[1],elements[2],elements[3],elements[4],elements[7]])
                                    writer.addFeature(fet)
                        elif int(elements[0])>=int(format(addhour, '%H%M')):
                            wrotetofile=1
                            point1 = QgsPointXY(float(elements[6].replace('\n','')),float(elements[5].replace('\n','')))
                            fet.setGeometry(QgsGeometry.fromPointXY(point1))
                            fet.setAttributes(['Wind',elements[0],elements[1],elements[2],elements[3],elements[4],elements[7]])
                            writer.addFeature(fet)
                if len(haillist)>0:                    
                    for i in haillist:
                        elements=re.split(',',i)
                        try:
                            hailsize=elements[1][0]+'.'+elements[1][1:3]
                        except:
                            hailsize=elements[1]
                        if int(format(datetime.utcnow(), '%H%M'))>=100 and int(format(datetime.utcnow(), '%H%M'))<=1215:
                            if int(elements[0])<1200:
                                if int(elements[0])>=int(format(addhour, '%H%M')):
                                    wrotetofile=1
                                    point1 = QgsPointXY(float(elements[6].replace('\n','')),float(elements[5].replace('\n','')))
                                    fet.setGeometry(QgsGeometry.fromPointXY(point1))
                                    fet.setAttributes(['Hail',elements[0],hailsize,elements[2],elements[3],elements[4],elements[7]])
                                    writer.addFeature(fet)
                        elif int(format(datetime.utcnow(), '%H%M'))==0:
                            if int(elements[0])>=2300  or int(elements[0])<=100:
                                if int(elements[0])>=int(format(addhour, '%H%M')) or int(elements[0])<=100:
                                    wrotetofile=1
                                    point1 = QgsPointXY(float(elements[6].replace('\n','')),float(elements[5].replace('\n','')))
                                    fet.setGeometry(QgsGeometry.fromPointXY(point1))
                                    fet.setAttributes(['Hail',elements[0],hailsize,elements[2],elements[3],elements[4],elements[7]])
                                    writer.addFeature(fet)
                        elif int(elements[0])>=int(format(addhour, '%H%M')):
                            wrotetofile=1
                            point1 = QgsPointXY(float(elements[6].replace('\n','')),float(elements[5].replace('\n','')))
                            fet.setGeometry(QgsGeometry.fromPointXY(point1))
                            fet.setAttributes(['Hail',elements[0],hailsize,elements[2],elements[3],elements[4],elements[7]])
                            writer.addFeature(fet)
                # if wrotetofile==0:
                    # point1 = QgsPointXY(39.00,-120.00)
                    # fet.setGeometry(QgsGeometry.fromPointXY(point1))
                    # fet.setAttributes(['None',elements[0],elements[1],elements[2],elements[3],elements[4],elements[7]])
                del writer
                try:
                    #self.canvas.freeze(True)
                    shutil.copyfile(self.GISpath + "Outlooks\\SPC\\Convective\\Workinglsr.shp", self.GISpath + "Outlooks\\SPC\\Convective\\lsr.shp")
                    shutil.copyfile(self.GISpath + "Outlooks\\SPC\\Convective\\Workinglsr.dbf", self.GISpath + "Outlooks\\SPC\\Convective\\lsr.dbf")
                    shutil.copyfile(self.GISpath + "Outlooks\\SPC\\Convective\\Workinglsr.cpg", self.GISpath + "Outlooks\\SPC\\Convective\\lsr.cpg")
                    #shutil.copyfile(self.GISpath + 'Snooper\WorkingSnooperShapefile.prj", self.GISpath + 'Snooper\SnooperShapefile.prj"))
                    shutil.copyfile(self.GISpath + "Outlooks\\SPC\\Convective\\Workinglsr.shx", self.GISpath + "Outlooks\\SPC\\Convective\\lsr.shx")
                    #self.canvas.freeze(False)
                except:
                    print("\n\nLSR shapefile error\n\n\n")
                    print(traceback.format_exc())
                    self.errorlist.append('LSR')
                    pass
        except:
            print("\n\nLSR error\n\n\n")
            print(traceback.format_exc())
            self.errorlist.append('LSR')
            # try:
                # os.remove('P:\\cory.mueller\\SA\\SA2.0\\GIS\\Outlooks\\SPC\\Convective\\Workinglsr.shp')
                # os.remove('P:\\cory.mueller\\SA\\SA2.0\\GIS\\Outlooks\\SPC\\Convective\\Workinglsr.shx')
                # os.remove('P:\\cory.mueller\\SA\\SA2.0\\GIS\\Outlooks\\SPC\\Convective\\Workinglsr.dbf')
                # os.remove('P:\\cory.mueller\\SA\\SA2.0\\GIS\\Outlooks\\SPC\\Convective\\Workinglsr.cpg')
            # except:
                # print(traceback.format_exc())
                # pass
            pass
            
    def getMDs(self):
        try:
            data=urllib.request.urlopen('https://www.spc.noaa.gov/products/md/', timeout=10).read().decode('utf-8')
            if 'No Mesoscale Discussions are currently in effect' not in data:
                data=re.split('\n',data)
                mdlist=[]
                for i in data:
                    #print(i)
                    if 'Mesoscale Discussion #' in i:
                        try:
                            mdlist.append(re.split('">',re.split('<a href="',i)[1])[0])
                        except:
                            pass
            else:
                mdlist=[]

            oldmdlist=[]
            try:
                mdlayerold=QgsVectorLayer(self.GISpath + "Outlooks\\SPC\\Convective\\MDs.shp", "LSR", "ogr")
                for feat in mdlayerold.getFeatures():
                    oldmdlist.append(feat.attributes()[0])
            except:
                pass

            if oldmdlist!=mdlist:
                fields = QgsFields()
                fields.append(QgsField("ID", QVariant.String))
                fields.append(QgsField("Concern", QVariant.String))

                writer = QgsVectorFileWriter(self.GISpath + "Outlooks\\SPC\\Convective\\WorkingMDs", "UTF-8", fields,
                                             QgsWkbTypes.MultiPolygon, QgsCoordinateReferenceSystem("EPSG:4269"), "ESRI Shapefile")

                if writer.hasError() != QgsVectorFileWriter.NoError:
                    print("Error when creating shapefile: ", writer.errorMessage())

                # Add a feature
                fet = QgsFeature()
                
                for i in mdlist:
                    try:
                        mdid=i
                        url='https://www.spc.noaa.gov' + i
                        data=urllib.request.urlopen(url, timeout=10).read().decode('utf-8')
                        data=re.split('\n',data)

                        concern=''
                        probWatch=''
                        count=0
                        for i in data:
                            if 'Concerning...' in i:
                                concern=re.split('Concerning...',i)[1].replace('Severe potential...','').replace('  ','')
                                if 'Severe Thunderstorm Watch' in concern or 'Tornado Watch' in concern:
                                    concern=re.split(' <a',concern)[0]
                            if 'Probability of Watch Issuance...' in i:
                                probWatch=re.split('Probability of Watch Issuance...',i)[1].replace('  ','')
                            if 'LAT...LON' in i:
                                latloncount=count
                            count=count+1
                        latlonlist=[]
                        status=0
                        while status==0:
                            if data[latloncount]=='':
                                status=1
                            else:
                                latlon=re.split(' ',data[latloncount].replace('LAT...LON   ',''))
                                for i in latlon:
                                    if i!='':
                                        latlonlist.append(i)
                            latloncount=latloncount+1
                        if probWatch!='':
                            text=concern + '(' + probWatch + ')'
                        else:
                            text=concern

                        coords=[]
                        for i in latlonlist:
                            lat=i[0:2]+'.'+i[2:4]
                            if i[4]=='0':
                                lon='-1'+i[4:6]+'.'+i[6:8]
                            elif i[4]=='1':
                                lon='-1'+i[4:6]+'.'+i[6:8]
                            elif i[4]=='2':
                                lon='-1'+i[4:6]+'.'+i[6:8]
                            else:
                                lon='-'+i[4:6]+'.'+i[6:8]
                            coords.append(QgsPointXY(float(lon),float(lat)))
                        fet.setGeometry(QgsGeometry.fromPolygonXY([coords]))
                        fet.setAttributes([mdid, text])
                        writer.addFeature(fet)
                    except:
                        print("\n\n\n\n\n")
                        print(traceback.format_exc())
                        pass

                del writer
                try:
                    #self.canvas.freeze(True)
                    shutil.copyfile(self.GISpath + "Outlooks\\SPC\\Convective\\WorkingMDs.shp", self.GISpath + "Outlooks\\SPC\\Convective\\MDs.shp")
                    shutil.copyfile(self.GISpath + "Outlooks\\SPC\\Convective\\WorkingMDs.dbf", self.GISpath + "Outlooks\\SPC\\Convective\\MDs.dbf")
                    shutil.copyfile(self.GISpath + "Outlooks\\SPC\\Convective\\WorkingMDs.cpg", self.GISpath + "Outlooks\\SPC\\Convective\\MDs.cpg")
                    #shutil.copyfile(self.GISpath + 'Snooper\WorkingSnooperShapefile.prj", self.GISpath + 'Snooper\SnooperShapefile.prj")
                    shutil.copyfile(self.GISpath + "Outlooks\\SPC\\Convective\\WorkingMDs.shx", self.GISpath + "Outlooks\\SPC\\Convective\\MDs.shx")
                    #self.canvas.freeze(False)
                except:
                    print("\n\nmd shapefile error\n\n\n")
                    print(traceback.format_exc())
                    self.errorlist.append('Convective MDs')
                    pass
        except:
            print("\n\n\n\n\n")
            print(traceback.format_exc())
            self.errorlist.append('Convective MDs')
            # try:
                # os.remove('P:\\cory.mueller\\SA\\SA2.0\\GIS\\Outlooks\\SPC\\Convective\\WorkingMDs.shp')
                # os.remove('P:\\cory.mueller\\SA\\SA2.0\\GIS\\Outlooks\\SPC\\Convective\\WorkingMDs.shx')
                # os.remove('P:\\cory.mueller\\SA\\SA2.0\\GIS\\Outlooks\\SPC\\Convective\\WorkingMDs.dbf')
                # os.remove('P:\\cory.mueller\\SA\\SA2.0\\GIS\\Outlooks\\SPC\\Convective\\WorkingMDs.cpg')
            # except:
                # pass
            pass
            
    def getMPDs(self):
        try:
            data=urllib.request.urlopen('https://www.wpc.ncep.noaa.gov/metwatch/metwatch_mpd.php', timeout=10).read().decode('utf-8')
            if 'No MPDs are currently in effect.' not in data:
                data=re.split('\n',data)
                mdlist=[]
                count=0
                for i in data:
                    if 'MPD #' in i:
                        try:
                            mdlist.append(re.split('">',re.split('<a href="',data[count-1])[1])[0])
                        except:
                            #print(traceback.format_exc())
                            pass
                    count=count+1
            else:
               mdlist=[]
               
            oldmdlist=[]
            try:
               mdlayerold=QgsVectorLayer(self.GISpath + "Outlooks\\WPC\\MPDs.shp", "LSR", "ogr")
               for feat in mdlayerold.getFeatures():
                   oldmdlist.append(feat.attributes()[0])
            except:
                pass

            if oldmdlist!=mdlist:
                fields = QgsFields()
                fields.append(QgsField("ID", QVariant.String))
                fields.append(QgsField("Concern", QVariant.String))

                writer = QgsVectorFileWriter(self.GISpath + "Outlooks\\WPC\\WorkingMPDs.shp", "UTF-8", fields,
                                             QgsWkbTypes.MultiPolygon, QgsCoordinateReferenceSystem("EPSG:4269"), "ESRI Shapefile")

                if writer.hasError() != QgsVectorFileWriter.NoError:
                    print("Error when creating shapefile: ", writer.errorMessage())

                # Add a feature
                fet = QgsFeature()
                
                for i in mdlist:
                    try:
                        mdid=i
                        url='https://www.wpc.ncep.noaa.gov' + i
                        data=urllib.request.urlopen(url, timeout=10).read().decode('utf-8')
                        data=re.split('\n',data)

                        concern=''
                        probWatch=''
                        count=0
                        for i in data:
                            if 'Concerning...' in i:
                                concern=re.split('Concerning...',i)[1].replace('Heavy rainfall...','').replace('  ','')
                            if 'LAT...LON' in i:
                                latloncount=count
                            count=count+1
                        latlonlist=[]
                        status=0
                        while status==0:
                            if data[latloncount]=='</pre>':
                                status=1
                            else:
                                latlon=re.split(' ',data[latloncount].replace('LAT...LON   ',''))
                                for i in latlon:
                                    if i!='':
                                        latlonlist.append(i)
                            latloncount=latloncount+1

                        coords=[]
                        for i in latlonlist:
                            lat=i[0:2]+'.'+i[2:4]
                            if i[4]=='0':
                                lon='-1'+i[4:6]+'.'+i[6:8]
                            elif i[4]=='1':
                                lon='-1'+i[4:6]+'.'+i[6:8]
                            elif i[4]=='2':
                                lon='-1'+i[4:6]+'.'+i[6:8]
                            else:
                                lon='-'+i[4:6]+'.'+i[6:8]
                            coords.append(QgsPointXY(float(lon),float(lat)))
                        fet.setGeometry(QgsGeometry.fromPolygonXY([coords]))
                        fet.setAttributes([mdid, concern])
                        writer.addFeature(fet)
                    except:
                        #print('\n\n\n\n\n\n')
                        #print(traceback.format_exc())
                        pass

                del writer
                try:
                    #self.canvas.freeze(True)
                    shutil.copyfile(self.GISpath + "Outlooks\\WPC\\WorkingMPDs.shp", self.GISpath + "Outlooks\\WPC\\MPDs.shp")
                    shutil.copyfile(self.GISpath + "Outlooks\\WPC\\WorkingMPDs.dbf", self.GISpath + "Outlooks\\WPC\\MPDs.dbf")
                    shutil.copyfile(self.GISpath + "Outlooks\\WPC\\WorkingMPDs.cpg", self.GISpath + "Outlooks\\WPC\\MPDs.cpg")
                    #shutil.copyfile(self.GISpath + 'Snooper\WorkingSnooperShapefile.prj", self.GISpath + 'Snooper\SnooperShapefile.prj")
                    shutil.copyfile(self.GISpath + "Outlooks\\WPC\\WorkingMPDs.shx", self.GISpath + "Outlooks\\WPC\\MPDs.shx")
                    #self.canvas.freeze(False)
                except:
                    print("\n\nmd shapefile error\n\n\n")
                    print(traceback.format_exc())
                    self.errorlist.append('Precip MDs')
                    pass
        except:
            pass
        
    def getdetailedWWA(self):
        try:
            try:
                #print('starting wwa')
                #self.getdetailedWWA()
                request=urllib.request.urlopen('https://tgftp.nws.noaa.gov/SL.us008001/DF.sha/DC.cap/DS.WWA/', timeout=15).read().decode('utf-8')
                updatetime=re.split('  </td><td',re.split('href="current_all.tar.gz">current_all.tar.gz</a></td><td align="right">',request)[1])[0]
                updatetime=datetime.strptime(updatetime, '%d-%b-%Y %H:%M')
                deltatime=datetime.utcnow()-updatetime
                timeago=re.split(':',str(deltatime))
                if 'day' in timeago[0] or 'days' in timeago[0]:
                    seconds=86400
                elif int(timeago[0])>0:
                    seconds=int(timeago[0])*3600
                else:
                    seconds=int(timeago[1])*60
                if seconds<=300:
                    #urllib.request.urlretrieve("https://tgftp.nws.noaa.gov/SL.us008001/DF.sha/DC.cap/DS.WWA/current_all.tar.gz", self.GISpath + "WWA\current_all.tar.gz")
                    r = requests.get("https://tgftp.nws.noaa.gov/SL.us008001/DF.sha/DC.cap/DS.WWA/current_all.tar.gz", allow_redirects=True, timeout=15)
                    with open(self.GISpath + "WWA\current_all.tar.gz", 'wb') as f:
                        f.write(r.content)
                    f.close()
                    self.canvas.freeze(True)
                    #self.windowtwo.freezecanvas()
                    my_tar = tarfile.open(self.GISpath + 'WWA\current_all.tar.gz')
                    my_tar.extractall(self.GISpath + 'WWA\\') # specify which folder to extract to
                    my_tar.close()
                    time.sleep(.5)
                    self.canvas.freeze(False)
                    #self.windowtwo.unfreezecanvas()
                if seconds >=3600:
                    self.canvas.freeze(True)
                    #self.windowtwo.freezecanvas()
                    self.wwaerror=1
                    shutil.copy(self.GISpath + 'WWA\WWAError.cpg',self.GISpath + 'WWA\current_all.cpg')
                    shutil.copy(self.GISpath + 'WWA\WWAError.dbf',self.GISpath + 'WWA\current_all.dbf')
                    #shutil.copy(self.GISpath + 'WWA\WWAError.prj',self.GISpath + 'WWA\current_all.prj')
                    shutil.copy(self.GISpath + 'WWA\WWAError.shx',self.GISpath + 'WWA\current_all.shx')
                    shutil.copy(self.GISpath + 'WWA\WWAError.shp',self.GISpath + 'WWA\current_all.shp')
                    time.sleep(.5)
                    self.canvas.freeze(False)
                    self.errorlist.append('WWA')
                    #self.windowtwo.unfreezecanvas()
                #print('getting detail')
            except:
                print("Error getting Hazards 1")
                try:
                    time.sleep(10)
                    #urllib.request.urlretrieve("https://tgftp.nws.noaa.gov/SL.us008001/DF.sha/DC.cap/DS.WWA/current_all.tar.gz", self.GISpath + "WWA\current_all.tar.gz")
                    r = requests.get("https://tgftp.nws.noaa.gov/SL.us008001/DF.sha/DC.cap/DS.WWA/current_all.tar.gz", allow_redirects=True, timeout=15)
                    with open(self.GISpath + "WWA\current_all.tar.gz", 'wb') as f:
                        f.write(r.content)
                    f.close()
                    self.canvas.freeze(True)
                    #self.windowtwo.freezecanvas()
                    my_tar = tarfile.open(self.GISpath + 'WWA\current_all.tar.gz')
                    my_tar.extractall(self.GISpath + 'WWA\\') # specify which folder to extract to
                    my_tar.close()
                    time.sleep(.5)
                    self.canvas.freeze(False)
                    #self.windowtwo.unfreezecanvas()
                except:
                    print("Error getting Hazards 2")
                    print(traceback.format_exc())
                    self.canvas.freeze(True)
                    #self.windowtwo.freezecanvas()
                    self.wwaerror=1
                    shutil.copy(self.GISpath + 'WWA\WWAError.cpg',self.GISpath + 'WWA\current_all.cpg')
                    shutil.copy(self.GISpath + 'WWA\WWAError.dbf',self.GISpath + 'WWA\current_all.dbf')
                    #shutil.copy(self.GISpath + 'WWA\WWAError.prj',self.GISpath + 'WWA\current_all.prj')
                    shutil.copy(self.GISpath + 'WWA\WWAError.shx',self.GISpath + 'WWA\current_all.shx')
                    shutil.copy(self.GISpath + 'WWA\WWAError.shp',self.GISpath + 'WWA\current_all.shp')
                    time.sleep(.5)
                    self.canvas.freeze(False)
                    self.errorlist.append('WWA')
                    #self.windowtwo.unfreezecanvas()

            self.canvas.freeze(True)
            shutil.copyfile(self.GISpath + "WWA\current_all.cpg", self.GISpath + "WWA\DetailedWWA.cpg")
            shutil.copyfile(self.GISpath + "WWA\current_all.dbf", self.GISpath + "WWA\DetailedWWA.dbf")
            shutil.copyfile(self.GISpath + "WWA\current_all.shp", self.GISpath + "WWA\DetailedWWA.shp")
            shutil.copyfile(self.GISpath + "WWA\current_all.shx", self.GISpath + "WWA\DetailedWWA.shx")
            self.canvas.freeze(False)

        except:
            print(traceback.format_exc())
            try:
                self.canvas.freeze(True)
                shutil.copyfile(self.GISpath + "WWA\current_all.cpg", self.GISpath + "WWA\DetailedWWA.cpg")
                shutil.copyfile(self.GISpath + "WWA\current_all.dbf", self.GISpath + "WWA\DetailedWWA.dbf")
                shutil.copyfile(self.GISpath + "WWA\current_all.shp", self.GISpath + "WWA\DetailedWWA.shp")
                shutil.copyfile(self.GISpath + "WWA\current_all.shx", self.GISpath + "WWA\DetailedWWA.shx")
                self.canvas.freeze(False)
            except:
                print(traceback.format_exc())
                self.canvas.freeze(True)
                self.wwaerror=1
                self.errorlist.append('WWA')
                shutil.copy(self.GISpath + 'WWA\WWAError.cpg',self.GISpath + 'WWA\DetailedWWA.cpg')
                shutil.copy(self.GISpath + 'WWA\WWAError.dbf',self.GISpath + 'WWA\DetailedWWA.dbf')
                shutil.copy(self.GISpath + 'WWA\WWAError.shx',self.GISpath + 'WWA\DetailedWWA.shx')
                shutil.copy(self.GISpath + 'WWA\WWAError.shp',self.GISpath + 'WWA\DetailedWWA.shp')
                time.sleep(.5)
                self.canvas.freeze(False)

        try:
            fields = QgsFields()
            fields.append(QgsField("PROD_TYPE", QVariant.String))

            writer = QgsVectorFileWriter(self.GISpath + "WWA\Working_SevereWWA.shp", "UTF-8", fields,
                                         QgsWkbTypes.MultiPolygon, QgsCoordinateReferenceSystem("EPSG:4269"), "ESRI Shapefile")

            if writer.hasError() != QgsVectorFileWriter.NoError:
                print("Error when creating shapefile: ", writer.errorMessage())

            # Add a feature
            fet = QgsFeature()
            products=['Tornado Watch','Severe Thunderstorm Watch']
            watchcount=0
            wwalayernew=QgsVectorLayer(self.GISpath + "WWA\\current_all.shp", "Detailed WWA", "ogr")
            for i in products:
                #print('"PROD_TYPE" = ' + "'" + 'Tornado Watch' + "'")
                wwalayernew.setSubsetString('"PROD_TYPE" = ' + "'" + i + "'")
                #processing.run("gdal:dissolve", wwalayernew, "", self.GISpath + 'WWA\SevereWWA.shp')
                event=''
                count=0
                for feat in wwalayernew.getFeatures():
                    attr=feat.attributes()
                    # print(attr)
                    # if event!=attr[7]:
                        # if count!=0:
                            # print('writting')
                            # fet.setGeometry(g)
                            # fet.setAttributes([attr[0], attr[1], attr[2], attr[3], attr[4], attr[5], attr[6], attr[7], attr[8], attr[9], attr[10], attr[11], attr[12]])
                            # writer.addFeature(fet)
                        # g=feat.geometry()
                        # event=attr[7]
                    # else:
                    if count==0:
                        g=feat.geometry()
                    else:
                        g=feat.geometry().combine(g)
                    count=count+1
                    watchcount=watchcount+1
                if count>0:
                    fet.setGeometry(g)
                    fet.setAttributes([attr[2]])
                    writer.addFeature(fet)
            del writer

            if watchcount>0:
                self.canvas.freeze(True)
                shutil.copy(self.GISpath + 'WWA\Working_SevereWWA.cpg',self.GISpath + 'WWA\SevereWWA.cpg')
                shutil.copy(self.GISpath + 'WWA\Working_SevereWWA.dbf',self.GISpath + 'WWA\SevereWWA.dbf')
                #shutil.copy(self.GISpath + 'WWA\Working_SevereWWA.prj',self.GISpath + 'WWA\SevereWWA.prj')
                shutil.copy(self.GISpath + 'WWA\Working_SevereWWA.shx',self.GISpath + 'WWA\SevereWWA.shx')
                shutil.copy(self.GISpath + 'WWA\Working_SevereWWA.shp',self.GISpath + 'WWA\SevereWWA.shp')
                time.sleep(.5)
                self.canvas.freeze(False)
            else:
                self.canvas.freeze(True)
                shutil.copy(self.GISpath + 'WWA\WWAError.cpg',self.GISpath + 'WWA\SevereWWA.cpg')
                shutil.copy(self.GISpath + 'WWA\WWAError.dbf',self.GISpath + 'WWA\SevereWWA.dbf')
                #shutil.copy(self.GISpath + 'WWA\WWAError.prj',self.GISpath + 'WWA\SevereWWA.prj')
                shutil.copy(self.GISpath + 'WWA\WWAError.shx',self.GISpath + 'WWA\SevereWWA.shx')
                shutil.copy(self.GISpath + 'WWA\WWAError.shp',self.GISpath + 'WWA\SevereWWA.shp')
                time.sleep(.5)
                self.canvas.freeze(False)
        except:
            print(traceback.format_exc())
            self.errorlist.append('Convective Watches')    

    def getoutlooks(self):
        try:
            #Convective Outlooks
            request=urllib.request.urlopen('https://www.spc.noaa.gov/products/outlook/', timeout=40).read().decode('utf-8')
            updatetime=re.split('<script type="text/javascript">',re.split("Updated:",request)[1])[0].replace("&nbsp;","")
            updatetime=datetime.strptime(updatetime, '%a %b %d %H:%M:%S UTC %Y')
            deltatime=datetime.utcnow()-updatetime
            timeago=re.split(':',str(deltatime))
            self.folderpath=self.GISpath
            if 'day' in timeago[0] or 'days' in timeago[0]:
                seconds=86400
            elif int(timeago[0])>0:
                seconds=int(timeago[0])*3600
            else:
                seconds=int(timeago[1])*60
            #print(seconds)
            if seconds <= 3600 or self.startup==1:
                updatemaps=1
                #Day 1
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/outlook/day1otlk-shp.zip", self.folderpath + "Outlooks\SPC\Convective\day1otlk-shp.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\SPC\Convective\day1otlk-shp.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\SPC\Convective\\")
                #Day 2
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/outlook/day2otlk-shp.zip", self.folderpath + "Outlooks\SPC\Convective\day2otlk-shp.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\SPC\Convective\day2otlk-shp.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\SPC\Convective\\")
                #Day 3
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/outlook/day3otlk-shp.zip", self.folderpath + "Outlooks\SPC\Convective\day3otlk-shp.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\SPC\Convective\day3otlk-shp.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\SPC\Convective\\")
                #Day 4
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/exper/day4-8/day4prob-shp.zip", self.folderpath + "Outlooks\SPC\Convective\Day4\\day4prob-shp.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\SPC\Convective\Day4\\day4prob-shp.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\SPC\Convective\\Day4\\")
                for item in os.listdir(self.folderpath + "Outlooks\SPC\Convective\\Day4\\"):
                    ending=re.split('\.',item)[1]
                    shutil.copy(self.folderpath + "Outlooks\SPC\Convective\\Day4\\" + item, self.folderpath + "Outlooks\SPC\Convective\\day4prob." + ending)
                for item in os.listdir(self.folderpath + "Outlooks\SPC\Convective\\Day4\\"):
                    os.remove(self.folderpath + "Outlooks\SPC\Convective\\Day4\\" + item)
                #Day 5
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/exper/day4-8/day5prob-shp.zip", self.folderpath + "Outlooks\SPC\Convective\\Day5\\day5prob-shp.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\SPC\Convective\\Day5\\day5prob-shp.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\SPC\Convective\\Day5\\")
                for item in os.listdir(self.folderpath + "Outlooks\SPC\Convective\\Day5\\"):
                    ending=re.split('\.',item)[1]
                    shutil.copy(self.folderpath + "Outlooks\SPC\Convective\\Day5\\" + item, self.folderpath + "Outlooks\SPC\Convective\\day5prob." + ending)
                for item in os.listdir(self.folderpath + "Outlooks\SPC\Convective\\Day5\\"):
                    os.remove(self.folderpath + "Outlooks\SPC\Convective\\Day5\\" + item)
                #Day 6
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/exper/day4-8/day6prob-shp.zip", self.folderpath + "Outlooks\SPC\Convective\\Day6\\day6prob-shp.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\SPC\Convective\\Day6\\day6prob-shp.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\SPC\Convective\\Day6\\")
                for item in os.listdir(self.folderpath + "Outlooks\SPC\Convective\\Day6\\"):
                    ending=re.split('\.',item)[1]
                    shutil.copy(self.folderpath + "Outlooks\SPC\Convective\\Day6\\" + item, self.folderpath + "Outlooks\SPC\Convective\\day6prob." + ending)
                for item in os.listdir(self.folderpath + "Outlooks\SPC\Convective\\Day6\\"):
                    os.remove(self.folderpath + "Outlooks\SPC\Convective\\Day6\\" + item)
                #Day 7
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/exper/day4-8/day7prob-shp.zip", self.folderpath + "Outlooks\SPC\Convective\\Day7\\day7prob-shp.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\SPC\Convective\\Day7\\day7prob-shp.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\SPC\Convective\\Day7\\")
                for item in os.listdir(self.folderpath + "Outlooks\SPC\Convective\\Day7\\"):
                    ending=re.split('\.',item)[1]
                    shutil.copy(self.folderpath + "Outlooks\SPC\Convective\\Day7\\" + item, self.folderpath + "Outlooks\SPC\Convective\\day7prob." + ending)
                for item in os.listdir(self.folderpath + "Outlooks\SPC\Convective\\Day7\\"):
                    os.remove(self.folderpath + "Outlooks\SPC\Convective\\Day7\\" + item)
            #Fire weather outlooks
            #https://www.spc.noaa.gov/products/fire_wx/day1fireotlk.kmz
            request=urllib.request.urlopen('https://www.spc.noaa.gov/products/fire_wx/', timeout=40).read().decode('utf-8')
            updatetime=re.split('<script type="text/javascript">',re.split("Updated:",request)[1])[0].replace("&nbsp;","")
            updatetime=datetime.strptime(updatetime, '%a %b %d %H:%M:%S UTC %Y')
            deltatime=datetime.utcnow()-updatetime
            timeago=re.split(':',str(deltatime))
            if 'day' in timeago[0] or 'days' in timeago[0]:
                seconds=900
            elif int(timeago[0])>0:
                seconds=int(timeago[0])*3600
            else:
                seconds=int(timeago[1])*60
            if seconds <= 900 or self.startup==1:
                updatemaps=1
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/fire_wx/day1firewx-shp.zip", self.folderpath + "Outlooks\SPC\Fire\day1firewx-shp.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\SPC\Fire\day1firewx-shp.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\SPC\Fire\\")
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/fire_wx/day2firewx-shp.zip", self.folderpath + "Outlooks\SPC\Fire\day2firewx-shp.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\SPC\Fire\day2firewx-shp.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\SPC\Fire\\")
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/fire_wx/day1fireotlk.kmz", self.folderpath + "Outlooks\SPC\Fire\day1fireotlk.kmz")
                urllib.request.urlretrieve("https://www.spc.noaa.gov/products/fire_wx/day2fireotlk.kmz", self.folderpath + "Outlooks\SPC\Fire\day2fireotlk.kmz")
            #WPC excessive rain outlooks
            request=urllib.request.urlopen('https://ftp.wpc.ncep.noaa.gov/shapefiles/qpf/excessive/', timeout=40).read().decode('utf-8')
            updatetime=re.split('  </td><td',re.split('href="EXCESSIVERAIN_Day1_latest.zip">EXCESSIVERAIN_Day1_latest.zip</a></td><td align="right">',request)[1])[0]
            updatetime=datetime.strptime(updatetime, '%d-%b-%Y %H:%M')
            deltatime=datetime.utcnow()-updatetime
            timeagod1=re.split(':',str(deltatime))
            updatetime=re.split('  </td><td',re.split('href="EXCESSIVERAIN_Day2_latest.zip">EXCESSIVERAIN_Day2_latest.zip</a></td><td align="right">',request)[1])[0]
            updatetime=datetime.strptime(updatetime, '%d-%b-%Y %H:%M')
            deltatime=datetime.utcnow()-updatetime
            timeagod2=re.split(':',str(deltatime))
            updatetime=re.split('  </td><td',re.split('href="EXCESSIVERAIN_Day3_latest.zip">EXCESSIVERAIN_Day3_latest.zip</a></td><td align="right">',request)[1])[0]
            updatetime=datetime.strptime(updatetime, '%d-%b-%Y %H:%M')
            deltatime=datetime.utcnow()-updatetime
            timeagod3=re.split(':',str(deltatime))
            if 'day' in timeagod1[0] or 'days' in timeagod1[0]:
                seconds=86400
            elif int(timeagod1[0])>0:
                seconds=int(timeagod1[0])*3600
            else:
                seconds=int(timeagod1[1])*60
            if seconds <= 900 or self.startup==1:
                updatemaps=1
                urllib.request.urlretrieve("https://ftp.wpc.ncep.noaa.gov/shapefiles/qpf/excessive/EXCESSIVERAIN_Day1_latest.zip", self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day1_latest.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day1_latest.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\WPC\Day1\\")
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day1\\"):
                    ending=re.split('\.',item)[1]
                    shutil.copy(self.folderpath + "Outlooks\WPC\Day1\\" + item, self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day1_latest." + ending)
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day1\\"):
                    #print(self.folderpath + "GIS\Outlooks\WPC\Day1\\" + item)
                    os.remove(self.folderpath + "Outlooks\WPC\Day1\\" + item)
            if 'day' in timeagod2[0] or 'days' in timeagod2[0]:
                seconds=86400
            elif int(timeagod2[0])>0:
                seconds=int(timeagod2[0])*3600
            else:
                seconds=int(timeagod2[1])*60
            if seconds <= 900 or self.startup==1:
                updatemaps=1
                urllib.request.urlretrieve("https://ftp.wpc.ncep.noaa.gov/shapefiles/qpf/excessive/EXCESSIVERAIN_Day2_latest.zip", self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day2_latest.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day2_latest.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\WPC\Day2\\")
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day2\\"):
                    ending=re.split('\.',item)[1]
                    shutil.copy(self.folderpath + "Outlooks\WPC\Day2\\" + item, self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day2_latest." + ending)
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day2\\"):
                    #print(self.folderpath + "GIS\Outlooks\WPC\Day2\\" + item)
                    os.remove(self.folderpath + "Outlooks\WPC\Day2\\" + item)
            if 'day' in timeagod3[0] or 'days' in timeagod3[0]:
                seconds=86400
            elif int(timeagod3[0])>0:
                seconds=int(timeagod3[0])*3600
            else:
                seconds=int(timeagod3[1])*60
            if seconds <= 900 or self.startup==1:
                updatemaps=1
                urllib.request.urlretrieve("https://ftp.wpc.ncep.noaa.gov/shapefiles/qpf/excessive/EXCESSIVERAIN_Day3_latest.zip", self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day3_latest.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day3_latest.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\WPC\Day3\\")
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day3\\"):
                    ending=re.split('\.',item)[1]
                    shutil.copy(self.folderpath + "Outlooks\WPC\Day3\\" + item, self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day3_latest." + ending)
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day3\\"):
                    #print(self.folderpath + "GIS\Outlooks\WPC\Day3\\" + item)
                    os.remove(self.folderpath + "Outlooks\WPC\Day3\\" + item)
            if seconds <= 900 or self.startup==1:
                updatemaps=1
                urllib.request.urlretrieve("https://ftp.wpc.ncep.noaa.gov/shapefiles/qpf/excessive/EXCESSIVERAIN_Day4_latest.zip", self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day4_latest.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day4_latest.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\WPC\Day4\\")
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day4\\"):
                    ending=re.split('\.',item)[1]
                    shutil.copy(self.folderpath + "Outlooks\WPC\Day4\\" + item, self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day4_latest." + ending)
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day4\\"):
                    #print(self.folderpath + "GIS\Outlooks\WPC\Day3\\" + item)
                    os.remove(self.folderpath + "Outlooks\WPC\Day4\\" + item) 
            if seconds <= 900 or self.startup==1:
                updatemaps=1
                urllib.request.urlretrieve("https://ftp.wpc.ncep.noaa.gov/shapefiles/qpf/excessive/EXCESSIVERAIN_Day5_latest.zip", self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day5_latest.zip")
                with zipfile.ZipFile(self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day5_latest.zip", 'r') as zip_ref:
                    zip_ref.extractall(self.folderpath + "Outlooks\WPC\Day5\\")
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day5\\"):
                    ending=re.split('\.',item)[1]
                    shutil.copy(self.folderpath + "Outlooks\WPC\Day5\\" + item, self.folderpath + "Outlooks\WPC\EXCESSIVERAIN_Day5_latest." + ending)
                for item in os.listdir(self.folderpath + "Outlooks\WPC\Day5\\"):
                    #print(self.folderpath + "GIS\Outlooks\WPC\Day3\\" + item)
                    os.remove(self.folderpath + "Outlooks\WPC\Day5\\" + item)
        except:
            print(traceback.format_exc())
            self.errorlist.append('Outlooks')
    
def main():
    app=QApplication(sys.argv)
    ex = SAGUI()
    ex.show()
    ex.resize(1920,1060)
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()